/**
 * Single CI entrypoint for `patch-sync.yml` (plan §3.3.1-3, §7 Phase 6).
 * Handles detect → sync → (fixture) → gates → demote-and-regate → report
 * writing, and prints `key=value` lines consumed by the workflow via
 * `$GITHUB_OUTPUT`. All git/gh (branch, commit, PR, issue, auto-merge)
 * operations stay in the workflow YAML, which only branches on this
 * script's `outcome` output — kept out of this file so the orchestration
 * logic is unit-testable without a GitHub Actions runner.
 *
 * Outcomes: `no-op` (patch unchanged) · `fetch-failure` (network/CDragon,
 * tolerated — see `sync-state.ts`) · `clean` (gates passed as-is) ·
 * `demoted` (gates passed after auto-demotion) · `gate-failure`
 * (unrecoverable — `main` must stay on the last good snapshot).
 */
import { cpSync, existsSync, rmSync } from "node:fs"
import { join } from "node:path"
import { pathToFileURL } from "node:url"
import { checkLatest } from "../data/check-latest"
import { renderDiffReport } from "../data/diff"
import { readJsonFile, writeJsonFile, writeTextFile } from "../data/fs-cache"
import { currentPointerPath, snapshotDir } from "../data/paths"
import { sync } from "../data/sync"
import { applyFixture } from "./__fixtures__/apply-fixture"
import { type DemotionRecord, demoteEntities, readDemotionsFile } from "./demote"
import { renderDemotionIssueBody, renderFailureIssueBody, renderPrBody } from "./patch-sync-report"
import { prunedSnapshots } from "./prune-snapshots"
import { runGates } from "./run-gates"
import type { GateReport } from "./types"

export type Outcome = "no-op" | "fetch-failure" | "clean" | "demoted" | "gate-failure"

type Args = {
  readonly patchOverride: string | null
  readonly force: boolean
  readonly fixture: "none" | "demote" | "fail-all"
  readonly runUrl: string
}

function parseArgs(argv: readonly string[]): Args {
  const get = (flag: string) => {
    const i = argv.indexOf(flag)
    return i === -1 ? undefined : argv[i + 1]
  }
  const fixture = get("--fixture") ?? "none"
  if (fixture !== "none" && fixture !== "demote" && fixture !== "fail-all") {
    throw new Error(`invalid --fixture "${fixture}"`)
  }
  return {
    patchOverride: get("--patch") ?? null,
    force: argv.includes("--force"),
    fixture,
    runUrl: get("--run-url") ?? "local",
  }
}

async function resolveTarget(
  patchOverride: string | null,
): Promise<{ current: string; target: string }> {
  const { patch: current } = readJsonFile<{ patch: string }>(currentPointerPath())
  if (patchOverride !== null) {
    return { current, target: patchOverride }
  }
  const latest = await checkLatest()
  return { current, target: latest.latest }
}

export type RunResult = {
  readonly outcome: Outcome
  readonly current: string
  readonly target: string
  readonly demotions: readonly DemotionRecord[]
  readonly gateReport: GateReport | null
  readonly errorMessage?: string
}

export async function runPatchSync(args: Args): Promise<RunResult> {
  const { current, target } = await resolveTarget(args.patchOverride)
  const isNew = target !== current || args.force

  if (!isNew) {
    return { outcome: "no-op", current, target, demotions: [], gateReport: null }
  }

  // A force re-sync of the *same* patch overwrites `snapshotDir(current)` in
  // place — comparing gates against it afterward would just compare the new
  // data to itself (no diff from "the regression I injected" either, which
  // is exactly how the gate-failure fixtures in __fixtures__/ get
  // demonstrated). Snapshot the pre-sync directory to a throwaway baseline
  // label first, and clean it up before returning either way.
  const baselineForGates = target === current ? scratchBaselineLabel(current) : current
  if (baselineForGates !== current && existsSync(snapshotDir(current))) {
    cpSync(snapshotDir(current), snapshotDir(baselineForGates), { recursive: true })
  }

  try {
    await sync(target, true, false)
  } catch (error) {
    writeJsonFile(currentPointerPath(), { patch: current }) // restore — don't let a half-written sync look "current"
    cleanupScratchBaseline(baselineForGates, current)
    return {
      outcome: "fetch-failure",
      current,
      target,
      demotions: [],
      gateReport: null,
      errorMessage: String(error),
    }
  }

  if (args.fixture !== "none") {
    applyFixture(args.fixture, target)
  }

  let report = runGates(target, baselineForGates, false)
  let demotions: DemotionRecord[] = []

  if (!report.passed) {
    if (report.failingEntities.length > 0) {
      demoteEntities(target, report.failingEntities)
      demotions = [...readDemotionsFile().demotions].filter((d) => d.patch === target)
      report = runGates(target, baselineForGates, false)
    }
    if (!report.passed) {
      writeJsonFile(currentPointerPath(), { patch: current })
      cleanupScratchBaseline(baselineForGates, current)
      return { outcome: "gate-failure", current, target, demotions, gateReport: report }
    }
  }

  writeTextFile(
    join(snapshotDir(target), "diff.md"),
    renderDiffReport(loadSnapshotSafe(current), loadSnapshotSafe(target)),
  )
  cleanupScratchBaseline(baselineForGates, current)
  prunedSnapshots()

  return {
    outcome: demotions.length > 0 ? "demoted" : "clean",
    current,
    target,
    demotions,
    gateReport: report,
  }
}

function scratchBaselineLabel(patch: string): string {
  return `${patch}~pre-resync`
}

function cleanupScratchBaseline(baselineForGates: string, current: string): void {
  if (baselineForGates !== current) {
    rmSync(snapshotDir(baselineForGates), { recursive: true, force: true })
  }
}

function loadSnapshotSafe(patch: string) {
  const dir = snapshotDir(patch)
  return {
    meta: readJsonFile(join(dir, "meta.json")),
    champions: readJsonFile(join(dir, "champions.json")),
    items: readJsonFile(join(dir, "items.json")),
  } as Parameters<typeof renderDiffReport>[0]
}

function writeOutputsAndReports(result: RunResult, runUrl: string): void {
  const outDir = ".patch-sync"
  writeJsonFile(join(outDir, "summary.json"), result)

  if (result.outcome === "clean" || result.outcome === "demoted") {
    if (result.gateReport === null)
      throw new Error("unreachable: passing outcome without a gate report")
    writeTextFile(
      join(outDir, "pr-body.md"),
      renderPrBody({
        current: result.current,
        target: result.target,
        gateReport: result.gateReport,
        demotions: result.demotions,
        runUrl,
      }),
    )
  }
  if (result.outcome === "demoted") {
    writeTextFile(
      join(outDir, "demotion-issue-body.md"),
      renderDemotionIssueBody({ target: result.target, demotions: result.demotions, runUrl }),
    )
  }
  if (result.outcome === "gate-failure") {
    writeTextFile(
      join(outDir, "failure-issue-body.md"),
      renderFailureIssueBody({
        current: result.current,
        target: result.target,
        gateReport: result.gateReport,
        runUrl,
        ...(result.errorMessage !== undefined ? { errorMessage: result.errorMessage } : {}),
      }),
    )
  }

  const demotedList = result.demotions.map((d) => `${d.kind}:${d.id}`).join(",")
  for (const [key, value] of Object.entries({
    outcome: result.outcome,
    current: result.current,
    target: result.target,
    demoted_count: String(result.demotions.length),
    demoted_list: demotedList,
  })) {
    console.log(`${key}=${value}`)
  }
}

async function runCli(): Promise<void> {
  const args = parseArgs(process.argv.slice(2))
  const result = await runPatchSync(args)
  writeOutputsAndReports(result, args.runUrl)
  if (result.outcome === "fetch-failure" || result.outcome === "gate-failure") {
    process.exitCode = result.outcome === "fetch-failure" ? 2 : 1
  }
}

const isMainModule =
  process.argv[1] !== undefined && import.meta.url === pathToFileURL(process.argv[1]).href
if (isMainModule) {
  runCli().catch((error) => {
    console.error(error)
    process.exit(3)
  })
}
