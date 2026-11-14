import type { ChampionData, ItemData } from "../../data/snapshot-schema"
import { lethalityToArmorPen } from "../mitigation"
import type { ResolvedStats, SplitStatKey } from "./types"
import { zeroSplit } from "./types"

const MIN_LEVEL = 1
const MAX_LEVEL = 18

/** Riot's standard stat growth multiplier for a given level: ports
 * `lolstats`' `statCalculator.js` `growthMultiplier` 1:1. */
export function growthMultiplier(level: number): number {
  const n = level - 1
  return n * (0.7025 + 0.0175 * n)
}

export function clampLevel(level: number): number {
  return Math.min(MAX_LEVEL, Math.max(MIN_LEVEL, level))
}

/** Sums every equipped item's flat stat contribution into one bag, keyed by
 * the engine's normalized stat names (see `item-stat-fields.ts`). */
function sumItemStats(items: readonly ItemData[]): Record<string, number> {
  const totals: Record<string, number> = {}
  for (const item of items) {
    for (const [key, value] of Object.entries(item.stats)) {
      totals[key] = (totals[key] ?? 0) + value
    }
  }
  return totals
}

/** Multiplicative AP amps declared as an `APAmp` passive data value (e.g.
 * Rabadon's Deathcap, +30% per patch 16.22 — wiki.leagueoflegends.com/en-us/
 * Rabadon%27s_Deathcap, cross-checked against the snapshot's own data value). */
function abilityPowerAmpMultiplier(items: readonly ItemData[]): number {
  let multiplier = 1
  for (const item of items) {
    for (const passive of item.passivesAndActives) {
      const amp = passive.dataValues.APAmp
      if (amp !== undefined) {
        multiplier *= 1 + amp
      }
    }
  }
  return multiplier
}

/** Combines N independent percent-penetration/reduction sources
 * multiplicatively (`1 - (1-p1)(1-p2)...`), matching how Riot stacks
 * percent armor/magic pen across multiple items. */
function combinePercent(values: readonly number[]): number {
  let remaining = 1
  for (const v of values) {
    remaining *= 1 - v
  }
  return 1 - remaining
}

export function statsAt(
  champion: ChampionData,
  level: number,
  items: readonly ItemData[] = [],
): ResolvedStats {
  const clamped = clampLevel(level)
  const mult = growthMultiplier(clamped)
  const c = champion.stats
  const itemTotals = sumItemStats(items)
  const get = (key: string): number => itemTotals[key] ?? 0

  const base: Record<SplitStatKey, number> = {
    health: c.hp + c.hpPerLevel * mult,
    armor: c.armor + c.armorPerLevel * mult,
    magicResist: c.magicResist + c.magicResistPerLevel * mult,
    attackDamage: c.attackDamage + c.attackDamagePerLevel * mult,
    abilityPower: 0,
  }

  const bonus = zeroSplit()
  bonus.health = get("health")
  bonus.armor = get("armor")
  bonus.magicResist = get("magicResist")
  bonus.attackDamage = get("attackDamage")
  bonus.abilityPower = get("abilityPower") * abilityPowerAmpMultiplier(items)

  const levelAsBonusPercent = (c.attackSpeedPerLevel / 100) * mult
  const itemAsPercent = get("attackSpeedPercent")
  const attackSpeed = c.attackSpeed * (1 + levelAsBonusPercent + itemAsPercent)

  const physicalLethality = get("physicalLethality")
  const armorPenetrationFlat =
    get("armorPenetrationFlat") + lethalityToArmorPen(physicalLethality, clamped)
  const armorPenetrationPercent = combinePercent(
    items.map((item) => item.stats.armorPenetrationPercent ?? 0).filter((v) => v > 0),
  )
  const magicPenetrationPercent = combinePercent(
    items.map((item) => item.stats.magicPenetrationPercent ?? 0).filter((v) => v > 0),
  )

  const total = {
    health: base.health + bonus.health,
    armor: base.armor + bonus.armor,
    magicResist: base.magicResist + bonus.magicResist,
    attackDamage: base.attackDamage + bonus.attackDamage,
    abilityPower: base.abilityPower + bonus.abilityPower,
    attackSpeed,
    criticalStrikeChance: Math.min(1, get("criticalStrikeChance")),
    criticalStrikeDamageMultiplier: c.critDamageMultiplier + get("criticalStrikeDamageBonus"),
    abilityHaste: get("abilityHaste"),
    armorPenetrationFlat,
    armorPenetrationPercent,
    magicPenetrationFlat: get("magicPenetrationFlat"),
    magicPenetrationPercent,
    physicalLethality,
    lifeSteal: get("lifeSteal"),
    omnivamp: get("omnivamp"),
  }

  return {
    level: clamped,
    base,
    bonus,
    total,
    attackSpeedRatio: c.attackSpeedRatio,
  }
}
