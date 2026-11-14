/**
 * `npm run data:gates -- --patch <p> [--baseline <p>] [--skip-golden]`
 *
 * Single entry point for every validation gate in plan §3.3.2 (Zod schema,
 * structural guard, coverage non-regression, golden tests, size budget).
 * Writes `data/snapshots/<patch>/gate-report.{json,md}` and exits non-zero
 * if any gate failed, so both CI (`ci.yml` data-change step) and
 * `patch-sync.yml` can branch on a single command's exit code while still
 * getting a machine-readable + human-readable report either way.
 *
 * `--baseline` defaults to whatever `data/current.json` pointed to before
 * this run (pass explicitly in CI, where the sync step has already
 * overwritten it — see `scripts/gates/README` note in patch-sync.yml).
 * `--skip-golden` lets the auto-demotion re-run (`demote.ts`) skip
 * re-running the (slow, patch-invariant) golden suite when only the
 * structural/coverage gates needed re-checking after a demotion.
 */
import { join } from "node:path"
import { pathToFileURL } from "node:url"
import { parseArgs } from "../data/cli-args"
import { writeJsonFile, writeTextFile } from "../data/fs-cache"
import { snapshotDir } from "../data/paths"
import { runGoldenGate } from "./golden-gate"
import { runSchemaGate } from "./schema-gate"
import { runSizeGate } from "./size-gate"
import { runCoverageGate, runStructuralGate } from "./structural-gate"
import {
  type FailingEntity,
  type GateOutcome,
  type GateReport,
  renderGateReportMarkdown,
} from "./types"

/** The same entity can be flagged by more than one gate (e.g. both
 * structural and coverage) — collapse to one record per entity, joining
 * reasons, so a demotion only ever produces one `data/demotions.json` row
 * and the PR/issue body doesn't repeat the same entity twice. */
function dedupeFailingEntities(entities: readonly FailingEntity[]): FailingEntity[] {
  const byKey = new Map<string, FailingEntity>()
  for (const entity of entities) {
    const key = `${entity.kind}:${entity.id}`
    const existing = byKey.get(key)
    byKey.set(
      key,
      existing === undefined
        ? entity
        : { ...existing, reason: `${existing.reason}; ${entity.reason}` },
    )
  }
  return [...byKey.values()]
}

export function runGates(patch: string, baseline: string | null, skipGolden: boolean): GateReport {
  const gates: GateOutcome[] = [
    runSchemaGate(patch),
    runStructuralGate(patch, baseline),
    runCoverageGate(patch, baseline),
    runSizeGate(patch),
  ]
  if (!skipGolden) {
    gates.push(runGoldenGate(patch))
  }

  const failingEntities = dedupeFailingEntities(gates.flatMap((g) => g.failingEntities))
  const report: GateReport = {
    patch,
    baseline,
    generatedAt: new Date().toISOString(),
    gates,
    passed: gates.every((g) => g.passed),
    failingEntities,
  }

  const dir = snapshotDir(patch)
  writeJsonFile(join(dir, "gate-report.json"), report)
  writeTextFile(join(dir, "gate-report.md"), renderGateReportMarkdown(report))
  return report
}

function parseExtraFlag(argv: readonly string[], flag: string): string | undefined {
  const index = argv.indexOf(flag)
  return index === -1 ? undefined : argv[index + 1]
}

async function runCli(): Promise<void> {
  const argv = process.argv.slice(2)
  const args = parseArgs(argv)
  const baseline = parseExtraFlag(argv, "--baseline") ?? null
  const skipGolden = argv.includes("--skip-golden")

  const report = runGates(args.patch, baseline, skipGolden)
  console.log(renderGateReportMarkdown(report))
  if (!report.passed) {
    process.exitCode = 1
  }
}

const isMainModule =
  process.argv[1] !== undefined && import.meta.url === pathToFileURL(process.argv[1]).href
if (isMainModule) {
  runCli().catch((error) => {
    console.error(error)
    process.exit(1)
  })
}
