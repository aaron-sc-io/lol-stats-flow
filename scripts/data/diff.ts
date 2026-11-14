/**
 * Patch-to-patch diff report (markdown): added/removed champions & items,
 * changed base stats, changed ability/item dataValues, changed formula
 * structure (calculation added/removed/changed shape).
 * `npm run data:diff -- <patchA> <patchB>`.
 */
import { join } from "node:path"
import { pathToFileURL } from "node:url"
import type { GameCalculation } from "../../src/data/formula-schema"
import type { ChampionData, ItemData, Snapshot } from "../../src/data/snapshot-schema"
import { parseArgs } from "./cli-args"
import { readJsonFile } from "./fs-cache"
import { snapshotDir } from "./paths"

function loadSnapshot(patch: string): Snapshot {
  const dir = snapshotDir(patch)
  return {
    meta: readJsonFile(join(dir, "meta.json")),
    champions: readJsonFile(join(dir, "champions.json")),
    items: readJsonFile(join(dir, "items.json")),
  }
}

function byId<T>(entries: readonly T[], idOf: (entry: T) => string): Map<string, T> {
  return new Map(entries.map((e) => [idOf(e), e]))
}

function diffKeys<T>(a: ReadonlyMap<string, T>, b: ReadonlyMap<string, T>) {
  const added = [...b.keys()].filter((k) => !a.has(k))
  const removed = [...a.keys()].filter((k) => !b.has(k))
  const common = [...a.keys()].filter((k) => b.has(k))
  return { added, removed, common }
}

function statsChanged(a: ChampionData["stats"], b: ChampionData["stats"]): string[] {
  const changes: string[] = []
  for (const key of Object.keys(a) as (keyof ChampionData["stats"])[]) {
    if (a[key] !== b[key]) {
      changes.push(`${key}: ${a[key]} → ${b[key]}`)
    }
  }
  return changes
}

function calculationsChanged(
  a: Record<string, GameCalculation>,
  b: Record<string, GameCalculation>,
): string[] {
  const changes: string[] = []
  const names = new Set([...Object.keys(a), ...Object.keys(b)])
  for (const name of names) {
    const inA = a[name]
    const inB = b[name]
    if (inA === undefined) {
      changes.push(`+ ${name}`)
    } else if (inB === undefined) {
      changes.push(`- ${name}`)
    } else if (JSON.stringify(inA) !== JSON.stringify(inB)) {
      changes.push(`~ ${name} (structure or values changed)`)
    }
  }
  return changes
}

function diffChampion(a: ChampionData, b: ChampionData): string[] {
  const lines: string[] = []
  const statChanges = statsChanged(a.stats, b.stats)
  if (statChanges.length > 0) {
    lines.push(`- Stats: ${statChanges.join(", ")}`)
  }
  for (const slot of ["P", "Q", "W", "E", "R"] as const) {
    const calcChanges = calculationsChanged(
      a.abilities[slot].calculations,
      b.abilities[slot].calculations,
    )
    if (calcChanges.length > 0) {
      lines.push(`- ${slot} calculations: ${calcChanges.join(", ")}`)
    }
  }
  return lines
}

function diffItem(a: ItemData, b: ItemData): string[] {
  const lines: string[] = []
  const statKeys = new Set([...Object.keys(a.stats), ...Object.keys(b.stats)])
  const statChanges: string[] = []
  for (const key of statKeys) {
    if (a.stats[key] !== b.stats[key]) {
      statChanges.push(`${key}: ${a.stats[key] ?? 0} → ${b.stats[key] ?? 0}`)
    }
  }
  if (statChanges.length > 0) {
    lines.push(`- Stats: ${statChanges.join(", ")}`)
  }
  if (a.goldTotal !== b.goldTotal) {
    lines.push(`- Gold: ${a.goldTotal} → ${b.goldTotal}`)
  }
  return lines
}

export function renderDiffReport(a: Snapshot, b: Snapshot): string {
  const lines: string[] = [`# Snapshot diff: ${a.meta.patch} → ${b.meta.patch}`, ""]

  const championsA = byId(a.champions, (c) => c.id)
  const championsB = byId(b.champions, (c) => c.id)
  const championDiff = diffKeys(championsA, championsB)
  lines.push("## Champions", "")
  if (championDiff.added.length > 0) lines.push(`- Added: ${championDiff.added.join(", ")}`)
  if (championDiff.removed.length > 0) lines.push(`- Removed: ${championDiff.removed.join(", ")}`)
  for (const id of championDiff.common) {
    const changes = diffChampion(
      championsA.get(id) as ChampionData,
      championsB.get(id) as ChampionData,
    )
    if (changes.length > 0) {
      lines.push(`### ${id}`, ...changes)
    }
  }

  const itemsA = byId(a.items, (i) => String(i.id))
  const itemsB = byId(b.items, (i) => String(i.id))
  const itemDiff = diffKeys(itemsA, itemsB)
  lines.push("", "## Items", "")
  if (itemDiff.added.length > 0) lines.push(`- Added: ${itemDiff.added.join(", ")}`)
  if (itemDiff.removed.length > 0) lines.push(`- Removed: ${itemDiff.removed.join(", ")}`)
  for (const id of itemDiff.common) {
    const changes = diffItem(itemsA.get(id) as ItemData, itemsB.get(id) as ItemData)
    if (changes.length > 0) {
      lines.push(`### ${id}`, ...changes)
    }
  }

  return lines.join("\n")
}

async function runCli(): Promise<void> {
  const args = parseArgs(process.argv.slice(2))
  const [patchA, patchB] = args.positionals
  if (patchA === undefined || patchB === undefined) {
    throw new Error("Usage: data:diff -- <patchA> <patchB>")
  }
  const report = renderDiffReport(loadSnapshot(patchA), loadSnapshot(patchB))
  console.log(report)
}

const isMainModule =
  process.argv[1] !== undefined && import.meta.url === pathToFileURL(process.argv[1]).href
if (isMainModule) {
  runCli().catch((error) => {
    console.error(error)
    process.exit(1)
  })
}
