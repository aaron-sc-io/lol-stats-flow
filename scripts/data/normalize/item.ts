import type { ItemData, ItemPassiveActive } from "../../../src/data/snapshot-schema"
import { ddragonItemIconUrl } from "../ddragon-client"
import { buildCalculationMap } from "./formula"
import { type HashTable, resolveHashToken } from "./hash-resolver"
import { normalizeStatFieldName } from "./item-stat-fields"

export type DdragonItemEntry = {
  readonly name: string
  readonly from?: readonly string[]
  readonly into?: readonly string[]
  readonly image: { readonly full: string }
  readonly gold: {
    readonly base: number
    readonly total: number
    readonly sell: number
    readonly purchasable: boolean
  }
  readonly tags?: readonly string[]
  readonly maps?: Record<string, boolean>
  readonly stats?: Record<string, number>
}

type RawItemRecord = Record<string, unknown>

function asDataValues(raw: unknown): Record<string, number> {
  if (!Array.isArray(raw)) {
    return {}
  }
  const result: Record<string, number> = {}
  for (const entry of raw) {
    if (
      entry !== null &&
      typeof entry === "object" &&
      typeof (entry as RawItemRecord).mName === "string" &&
      typeof (entry as RawItemRecord).mValue === "number"
    ) {
      result[(entry as RawItemRecord).mName as string] = (entry as RawItemRecord).mValue as number
    }
  }
  return result
}

function collectStats(
  ddragonStats: Record<string, number> | undefined,
  record: RawItemRecord | null,
): Record<string, number> {
  const stats: Record<string, number> = {}
  for (const [key, value] of Object.entries(ddragonStats ?? {})) {
    stats[normalizeStatFieldName(key)] = value
  }
  if (record !== null) {
    for (const [key, value] of Object.entries(record)) {
      if (key.endsWith("Mod") && typeof value === "number") {
        const normalized = normalizeStatFieldName(key)
        if (!(normalized in stats)) {
          stats[normalized] = value
        }
      }
    }
  }
  return stats
}

function collectUniqueGroups(record: RawItemRecord | null, hashes: HashTable): string[] {
  if (record === null || !Array.isArray(record.mItemGroups)) {
    return []
  }
  return record.mItemGroups
    .filter((g): g is string => typeof g === "string")
    .map((g) => resolveHashToken(g, hashes))
}

function buildBuiltinPassive(
  record: RawItemRecord | null,
  hashes: HashTable,
  name: string,
): ItemPassiveActive[] {
  if (record === null) {
    return []
  }
  const calculations = buildCalculationMap(record.mItemCalculations, hashes)
  const dataValues = asDataValues(record.mDataValues)
  if (Object.keys(calculations).length === 0 && Object.keys(dataValues).length === 0) {
    return []
  }
  return [{ name, dataValues, calculations, isActive: false }]
}

export function normalizeItem(
  id: number,
  entry: DdragonItemEntry,
  record: RawItemRecord | null,
  ddragonVersion: string,
  hashes: HashTable,
  modeled: boolean,
): ItemData {
  return {
    id,
    name: entry.name,
    iconUrl: ddragonItemIconUrl(ddragonVersion, entry.image.full),
    goldBase: entry.gold.base,
    goldTotal: entry.gold.total,
    goldSell: entry.gold.sell,
    purchasable: entry.gold.purchasable,
    statCategories: [...(entry.tags ?? [])],
    stats: collectStats(entry.stats, record),
    from: [...(entry.from ?? [])],
    into: [...(entry.into ?? [])],
    maps: { ...(entry.maps ?? {}) },
    uniqueGroups: collectUniqueGroups(record, hashes),
    maxStack: record !== null && typeof record.maxStack === "number" ? record.maxStack : 1,
    passivesAndActives: buildBuiltinPassive(record, hashes, entry.name),
    modeled,
  }
}
