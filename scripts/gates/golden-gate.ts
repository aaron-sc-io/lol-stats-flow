/**
 * Gate — golden / reference-evaluator tests (plan §3.3.2: `npm test --
 * src/engine`). Spawned as a subprocess rather than invoking Vitest's API
 * in-process, so a crash/hang in the test runner can't take the gate
 * orchestrator down with it. Runs with Vitest's `json` reporter (written to
 * a scratch file, not stdout) so both the human-readable PR/issue summary
 * and the per-entity `FailingEntity[]` the auto-demotion step consumes
 * (plan §3.3.3, `demote.ts`) are derived from one structured run instead of
 * parsing ad hoc dot-reporter text.
 *
 * `__golden__/pinned/*.test.ts` failures are NEVER turned into
 * `FailingEntity` records: they assert hand-verified absolute numbers
 * against a frozen fixture, so a failure there is a genuine engine-logic
 * regression a human must fix, not a data problem auto-demotion can paper
 * over. Only `__golden__/reference/*.test.ts` failures (patch-agnostic,
 * re-run against the candidate snapshot) are entity-attributable and
 * therefore demotable.
 */
import { spawnSync } from "node:child_process"
import { join } from "node:path"
import type { ChampionData, ItemData } from "../../src/data/schema"
import { readJsonFile, readTextFileIfExists } from "../data/fs-cache"
import { snapshotDir } from "../data/paths"
import { type FailingEntity, type GateOutcome, gateFail, gatePass } from "./types"

const REPORT_PATH = join(process.cwd(), ".cache", "gates", "golden-gate-report.json")
const OUTPUT_TAIL_CHARS = 4000
const DEMOTABLE_PATH_SEGMENT = "__golden__/reference/"

type VitestAssertion = {
  readonly fullName: string
  readonly status: string
  readonly failureMessages: readonly string[]
}
type VitestFileResult = {
  readonly name: string
  readonly assertionResults: readonly VitestAssertion[]
}
type VitestJsonReport = {
  readonly numFailedTests: number
  readonly testResults: readonly VitestFileResult[]
}

type EntityCatalogEntry = {
  readonly kind: "champion" | "item"
  readonly id: string
  readonly name: string
}

function entityCatalog(patch: string): readonly EntityCatalogEntry[] {
  const dir = snapshotDir(patch)
  const champions = readJsonFile<ChampionData[]>(join(dir, "champions.json"))
  const items = readJsonFile<ItemData[]>(join(dir, "items.json"))
  return [
    ...champions
      .filter((c) => c.modeled)
      .map((c): EntityCatalogEntry => ({ kind: "champion", id: c.id, name: c.name })),
    ...items
      .filter((i) => i.modeled)
      .map((i): EntityCatalogEntry => ({ kind: "item", id: String(i.id), name: i.name })),
  ]
}

/** A failing reference test's title always names the champion/item it
 * exercises (every `reference/*.test.ts` describe/it block is written that
 * way — see e.g. `reference/brand.test.ts`), so a plain substring match
 * against the known modeled-entity catalog is enough to attribute the
 * failure without any special test-side tagging convention. */
function entitiesMentionedIn(
  text: string,
  catalog: readonly EntityCatalogEntry[],
): EntityCatalogEntry[] {
  // Guard against an empty `name` (some unmodeled items have no display
  // name in CDragon) — `"".includes("")` is vacuously true in JS and would
  // otherwise attribute every failure to every nameless entity.
  return catalog.filter((entity) => entity.name.length > 0 && text.includes(entity.name))
}

function collectFailingEntities(
  report: VitestJsonReport,
  catalog: readonly EntityCatalogEntry[],
): FailingEntity[] {
  const failing: FailingEntity[] = []
  for (const file of report.testResults) {
    if (!file.name.includes(DEMOTABLE_PATH_SEGMENT)) {
      continue
    }
    for (const assertion of file.assertionResults) {
      if (assertion.status !== "failed") {
        continue
      }
      const reasonText = `${assertion.fullName} :: ${assertion.failureMessages.join(" ")}`
      for (const entity of entitiesMentionedIn(reasonText, catalog)) {
        failing.push({
          kind: entity.kind,
          id: entity.id,
          name: entity.name,
          reason: `reference golden test failed: ${assertion.fullName}`,
        })
      }
    }
  }
  return failing
}

function renderHumanSummary(report: VitestJsonReport): string {
  const failingTitles = report.testResults
    .flatMap((file) => file.assertionResults)
    .filter((a) => a.status === "failed")
    .map((a) => `- ${a.fullName}\n  ${a.failureMessages.join("\n  ")}`)
  const text = failingTitles.join("\n")
  return text.length > OUTPUT_TAIL_CHARS ? text.slice(-OUTPUT_TAIL_CHARS) : text
}

export function runGoldenGate(patch: string): GateOutcome {
  const result = spawnSync(
    "npm",
    ["test", "--", "src/engine", "--reporter=json", `--outputFile=${REPORT_PATH}`],
    { encoding: "utf8", shell: true },
  )
  const reportText = readTextFileIfExists(REPORT_PATH)
  if (reportText === null) {
    const output = `${result.stdout ?? ""}${result.stderr ?? ""}`
    const tail = output.length > OUTPUT_TAIL_CHARS ? output.slice(-OUTPUT_TAIL_CHARS) : output
    return gateFail(
      "golden-tests",
      `\`npm test -- src/engine\` produced no JSON report (exit ${result.status}):\n\n\`\`\`\n${tail}\n\`\`\``,
    )
  }
  const report = JSON.parse(reportText) as VitestJsonReport
  if (report.numFailedTests === 0) {
    return gatePass("golden-tests", "`npm test -- src/engine` passed (pinned + reference)")
  }
  const catalog = entityCatalog(patch)
  const failingEntities = collectFailingEntities(report, catalog)
  return gateFail(
    "golden-tests",
    `${report.numFailedTests} golden test(s) failed:\n\n\`\`\`\n${renderHumanSummary(report)}\n\`\`\``,
    failingEntities,
  )
}
