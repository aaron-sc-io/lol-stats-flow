import type { ChampionData, ItemData, Snapshot } from "../data/snapshot-schema"
import { buildBrandKit } from "./bindings/brand"
import { buildDariusKit } from "./bindings/darius"
import { buildGarenKit } from "./bindings/garen"
import { defaultRankAtLevel } from "./bindings/helpers"
import { buildItemActions, buildItemPassiveTriggers } from "./bindings/items"
import { buildVayneKit } from "./bindings/vayne"
import { buildYasuoKit } from "./bindings/yasuo"
import type { Kit } from "./sim/types"
import { statsAt } from "./stats/stats-at"

/** Melee/ranged is not carried in the snapshot (DDragon/CDragon don't
 * expose it directly); hardcoded for the 5 modeled champions only — used by
 * Blade of the Ruined King / Kraken Slayer's melee-vs-ranged value split. */
const MELEE_CHAMPION_IDS: ReadonlySet<string> = new Set(["Yasuo", "Darius", "Garen"])

export type BuildKitParams = {
  readonly championId: string
  readonly level: number
  readonly items: readonly string[]
  readonly rankOverrides?: Partial<Record<"Q" | "W" | "E" | "R", number>>
}

const CHAMPION_BUILDERS: Record<
  string,
  (
    champion: ChampionData,
    level: number,
    stats: ReturnType<typeof statsAt>,
    ranks: Record<string, number | undefined>,
  ) => Kit
> = {
  Yasuo: buildYasuoKit,
  Brand: buildBrandKit,
  Vayne: buildVayneKit,
  Darius: buildDariusKit,
  Garen: buildGarenKit,
}

const RANKED_SLOTS = ["Q", "W", "E", "R"] as const

/** Resolves a champion + level + item set into a `Kit`: fully-resolved
 * stats plus the list of simulate-able `ComboAction`s (ability damage
 * components, crit/stack variants, AAs, item actives) and passive triggers
 * (on-hit procs, stacking debuffs, spellblade). Throws if `championId` is
 * not one of the 5 modeled champions — callers should check
 * `ChampionData.modeled` before calling.
 *
 * Any ability rank not given an explicit `rankOverrides[slot]` defaults to
 * the plan §1 level-appropriate standard order (R at 6/11/16, basic
 * abilities ramping roughly every other level — `defaultRankAtLevel`), NOT
 * to the ability's max rank — so the champion `level` parameter actually
 * changes simulated damage even with no per-ability override set. */
export function buildKit(snapshot: Snapshot, params: BuildKitParams): Kit {
  const champion = snapshot.champions.find((c) => c.id === params.championId)
  if (champion === undefined) {
    throw new Error(`buildKit: unknown championId "${params.championId}"`)
  }
  const builder = CHAMPION_BUILDERS[champion.name]
  if (builder === undefined) {
    throw new Error(`buildKit: "${champion.name}" is not a modeled champion (no engine binding)`)
  }
  const equippedItems: ItemData[] = params.items
    .map((name) => snapshot.items.find((i) => i.name === name))
    .filter((i): i is ItemData => i !== undefined)

  const rankOverrides: Partial<Record<"Q" | "W" | "E" | "R", number>> = {}
  for (const slot of RANKED_SLOTS) {
    const maxRank = champion.abilities[slot].maxRank
    if (maxRank > 0) {
      rankOverrides[slot] =
        params.rankOverrides?.[slot] ?? defaultRankAtLevel(slot, params.level, maxRank)
    }
  }

  const stats = statsAt(champion, params.level, equippedItems)
  const kit = builder(champion, params.level, stats, rankOverrides)

  const isMelee = MELEE_CHAMPION_IDS.has(champion.name)
  const itemTriggers = buildItemPassiveTriggers(equippedItems, isMelee)
  const itemActions = buildItemActions(equippedItems)

  return {
    ...kit,
    sourceId: params.championId,
    actions: [...kit.actions, ...itemActions],
    passiveTriggers: [...kit.passiveTriggers, ...itemTriggers],
  }
}
