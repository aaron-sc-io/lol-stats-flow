/**
 * Test-only fixture injector for demonstrating the two gate-failure paths
 * (plan §7 Phase 6 AC "Simulated gate failure"). Never used in a real
 * patch-sync run (`fixture=none` is the default workflow_dispatch input).
 *
 * `demote`: edits ONLY the candidate patch's `coverage.json` (a derived
 * report artifact), understating one modeled item's `calculationCount` so
 * the structural/coverage gates see a regression relative to baseline. The
 * underlying `champions.json`/`items.json` are never touched, so once
 * `demote.ts` flips that item to `modeled: false` and regenerates
 * `coverage.json` from the real (untouched) data, the "regression"
 * disappears and the gate re-run goes green — exactly the recoverable
 * single-entity failure the demotion path exists for.
 *
 * `fail-all`: removes a required field from one champion's committed
 * `champions.json` so `SnapshotSchema` rejects the whole snapshot. The
 * schema gate has no notion of "failing entities" to demote around, so
 * this is unrecoverable by design — it must fall through to
 * `patch-sync-failure`.
 */
import { join } from "node:path"
import { pathToFileURL } from "node:url"
import type { EntityCoverage } from "../../data/coverage"
import { readJsonFile, writeJsonFile } from "../../data/fs-cache"
import { snapshotDir } from "../../data/paths"

type CoverageReport = {
  champions: EntityCoverage[]
  items: EntityCoverage[]
}

const DEMOTE_FIXTURE_ITEM_ID = "3071" // Black Cleaver (1 tracked calc in coverage.json)

function applyDemoteFixture(patch: string): void {
  const path = join(snapshotDir(patch), "coverage.json")
  const report = readJsonFile<CoverageReport>(path)
  const index = report.items.findIndex((i) => i.id === DEMOTE_FIXTURE_ITEM_ID)
  const item = report.items[index]
  if (item === undefined) {
    throw new Error(`fixture target item ${DEMOTE_FIXTURE_ITEM_ID} not found in ${path}`)
  }
  report.items[index] = { ...item, calculationCount: Math.max(0, item.calculationCount - 1) }
  writeJsonFile(path, report)
  console.log(
    `[fixture:demote] understated calculationCount for item ${DEMOTE_FIXTURE_ITEM_ID} in ${path}`,
  )
}

function applyFailAllFixture(patch: string): void {
  const path = join(snapshotDir(patch), "champions.json")
  const champions = readJsonFile<Array<Record<string, unknown>>>(path)
  const first = champions[0]
  if (first === undefined) {
    throw new Error(`no champions found in ${path}`)
  }
  delete first.stats
  writeJsonFile(path, champions)
  console.log(`[fixture:fail-all] deleted "stats" from champion ${String(first.id)} in ${path}`)
}

export function applyFixture(kind: "demote" | "fail-all", patch: string): void {
  if (kind === "demote") {
    applyDemoteFixture(patch)
  } else {
    applyFailAllFixture(patch)
  }
}

async function runCli(): Promise<void> {
  const argv = process.argv.slice(2)
  const kind = argv[0]
  const patch = argv[1]
  if ((kind !== "demote" && kind !== "fail-all") || patch === undefined) {
    throw new Error("Usage: apply-fixture.ts <demote|fail-all> <patch>")
  }
  applyFixture(kind, patch)
}

const isMainModule =
  process.argv[1] !== undefined && import.meta.url === pathToFileURL(process.argv[1]).href
if (isMainModule) {
  runCli().catch((error) => {
    console.error(error)
    process.exit(1)
  })
}
