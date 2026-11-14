/**
 * Coverage report: per champion/item calculation counts, unknown
 * `FormulaNode` kinds, and unresolved hash tokens — written as
 * `coverage.json` (machine-readable) and `COVERAGE.md` (human-readable,
 * modeled entities listed first per plan §3.2/§7 Phase 1 AC).
 */
import { join } from "node:path"
import { pathToFileURL } from "node:url"
import type { ChampionData, ItemData, Snapshot } from "../../src/data/snapshot-schema"
import { parseArgs } from "./cli-args"
import {
  type CalculationStats,
  mergeCalculationStats,
  newCalculationStats,
  visitCalculation,
} from "./coverage-walk"
import { readJsonFile, writeJsonFile, writeTextFile } from "./fs-cache"
import { snapshotDir } from "./paths"

export type EntityCoverage = {
  readonly id: string
  readonly name: string
  readonly modeled: boolean
  readonly calculationCount: number
  readonly calculationNames: readonly string[]
  readonly unknownPartCount: number
  readonly unresolvedCount: number
}

function coverageFor(
  id: string,
  name: string,
  modeled: boolean,
  stats: CalculationStats,
  calculationNames: string[],
): EntityCoverage {
  const unknownPartCount = [...stats.unknownPartsByType.values()].reduce((a, b) => a + b, 0)
  return {
    id,
    name,
    modeled,
    calculationCount: calculationNames.length,
    calculationNames,
    unknownPartCount,
    unresolvedCount: stats.unresolvedHashNames.size,
  }
}

function championCoverage(champion: ChampionData, global: CalculationStats): EntityCoverage {
  const stats = newCalculationStats()
  const names: string[] = []
  for (const slot of ["P", "Q", "W", "E", "R"] as const) {
    const ability = champion.abilities[slot]
    for (const [calcName, calc] of Object.entries(ability.calculations)) {
      names.push(`${slot}.${calcName}`)
      visitCalculation(calc, stats)
    }
  }
  mergeCalculationStats(global, stats)
  return coverageFor(champion.id, champion.name, champion.modeled, stats, names)
}

function itemCoverage(item: ItemData, global: CalculationStats): EntityCoverage {
  const stats = newCalculationStats()
  const names: string[] = []
  for (const passive of item.passivesAndActives) {
    for (const [calcName, calc] of Object.entries(passive.calculations)) {
      names.push(`${passive.name}.${calcName}`)
      visitCalculation(calc, stats)
    }
  }
  mergeCalculationStats(global, stats)
  return coverageFor(String(item.id), item.name, item.modeled, stats, names)
}

function sortModeledFirst(entries: EntityCoverage[]): EntityCoverage[] {
  return [...entries].sort((a, b) => {
    if (a.modeled !== b.modeled) {
      return a.modeled ? -1 : 1
    }
    return a.name.localeCompare(b.name)
  })
}

function renderEntitySection(entries: EntityCoverage[]): string[] {
  const lines: string[] = []
  for (const entry of entries) {
    lines.push(
      `### ${entry.name}`,
      "",
      `- Calculations: ${entry.calculationCount}`,
      ...entry.calculationNames.map((n) => `  - \`${n}\``),
      `- Unknown parts: ${entry.unknownPartCount}`,
      `- Unresolved hashes: ${entry.unresolvedCount}`,
      "",
    )
  }
  return lines
}

function renderSummaryTable(title: string, entries: EntityCoverage[]): string[] {
  const lines = [
    `## ${title}`,
    "",
    "| Name | Modeled | Calculations | Unknown parts | Unresolved |",
    "|---|---|---|---|---|",
  ]
  for (const entry of entries) {
    lines.push(
      `| ${entry.name} | ${entry.modeled ? "yes" : ""} | ${entry.calculationCount} | ${entry.unknownPartCount} | ${entry.unresolvedCount} |`,
    )
  }
  return lines
}

function renderMarkdown(
  champions: EntityCoverage[],
  items: EntityCoverage[],
  globalStats: CalculationStats,
): string {
  const lines: string[] = ["# Data Coverage Report", ""]
  lines.push("## Modeled champions", "", ...renderEntitySection(champions.filter((c) => c.modeled)))
  lines.push("## Modeled items", "", ...renderEntitySection(items.filter((i) => i.modeled)))
  lines.push(...renderSummaryTable("All champions (summary)", champions))
  lines.push("", ...renderSummaryTable("All items (summary)", items))
  lines.push("", "## Unknown FormulaNode part types (global)", "")
  const unknownEntries = [...globalStats.unknownPartsByType.entries()].sort((a, b) => b[1] - a[1])
  if (unknownEntries.length === 0) {
    lines.push("None encountered.")
  } else {
    lines.push("| Type | Count |", "|---|---|")
    for (const [type, count] of unknownEntries) {
      lines.push(`| \`${type}\` | ${count} |`)
    }
  }
  return lines.join("\n")
}

export function writeCoverageReports(snapshot: Snapshot): void {
  const globalStats = newCalculationStats()
  const champions = sortModeledFirst(
    snapshot.champions.map((c) => championCoverage(c, globalStats)),
  )
  const items = sortModeledFirst(snapshot.items.map((i) => itemCoverage(i, globalStats)))

  const dir = snapshotDir(snapshot.meta.patch)
  writeJsonFile(join(dir, "coverage.json"), {
    generatedAt: new Date().toISOString(),
    champions,
    items,
    unknownPartTypesGlobal: Object.fromEntries(globalStats.unknownPartsByType),
    unresolvedHashesGlobal: [...globalStats.unresolvedHashNames],
  })
  writeTextFile(join(dir, "COVERAGE.md"), renderMarkdown(champions, items, globalStats))
}

async function runCli(): Promise<void> {
  const args = parseArgs(process.argv.slice(2))
  const dir = snapshotDir(args.patch)
  const snapshot: Snapshot = {
    meta: readJsonFile(join(dir, "meta.json")),
    champions: readJsonFile(join(dir, "champions.json")),
    items: readJsonFile(join(dir, "items.json")),
  }
  writeCoverageReports(snapshot)
  console.log(`[coverage] wrote coverage.json + COVERAGE.md for ${args.patch}`)
}

const isMainModule =
  process.argv[1] !== undefined && import.meta.url === pathToFileURL(process.argv[1]).href
if (isMainModule) {
  runCli().catch((error) => {
    console.error(error)
    process.exit(1)
  })
}
