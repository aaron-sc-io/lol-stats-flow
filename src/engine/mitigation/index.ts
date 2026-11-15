/**
 * Damage mitigation math — ported from the original `lolstats` project's
 * `damageMitigationCalculator.js`, now in strict TypeScript.
 *
 * Sources:
 *   https://wiki.leagueoflegends.com/en-us/Armor
 *   https://wiki.leagueoflegends.com/en-us/Magic_resistance
 *
 * Mitigation formula (R = resistance AFTER penetration/reduction is applied):
 *   postMitigationDamage = preMitigationDamage / (1 + R/100)          if R >= 0
 *   postMitigationDamage = preMitigationDamage * (2 - 100/(100 - R))  if R < 0
 *
 * Penetration order of operations, applied to the target's base resistance
 * before computing the formula above:
 *   1. Flat resistance reductions/debuffs (e.g. Black Cleaver shred) — additive
 *   2. Percent resistance reduction (multiplicative)
 *   3. Percent penetration (multiplicative; does not apply once resistance is
 *      already <= 0)
 *   4. Flat penetration (subtracted last; never drives effective resistance
 *      below 0)
 */

export type PenetrationStats = {
  readonly flatReduction?: number
  readonly percentReduction?: number
  readonly percentPen?: number
  /** Percent penetration that only ignores the target's BONUS resistance
   * (e.g. Yasuo's Last Breath crits: "ignore 60% bonus Armor"). Applied in
   * the same step as `percentPen`, to the bonus share of what remains. */
  readonly bonusPercentPen?: number
  readonly flatPen?: number
}

export type DamageType = "physical" | "magic" | "true"

/**
 * Converts Lethality (a flat armor-pen stat granted by items such as
 * Youmuu's Ghostblade / Serrated Dirk / Black Cleaver) into its effective
 * flat armor penetration value at a given champion level.
 *
 * Verified current for patch 16.22 against
 * https://wiki.leagueoflegends.com/en-us/Lethality: `effective armor pen =
 * lethality * (0.6 + 0.4 * level / 18)`. At level 18 this is a 1:1
 * conversion; at level 1 it is ~62.2%. (The formula has not changed since
 * its season 7 introduction and remains the documented value for 16.22.)
 */
export function lethalityToArmorPen(lethality: number, level: number): number {
  if (lethality === 0) {
    return 0
  }
  const clampedLevel = Math.min(20, Math.max(1, level))
  return lethality * (0.6 + (0.4 * clampedLevel) / 18)
}

/**
 * Resolves the target's effective resistance after applying reductions and
 * penetration in Riot's documented order of operations.
 *
 * `totalResistance` is the target's full armor/MR; `bonusResistance` is the
 * part of it that is bonus (items/runes), used only by `bonusPercentPen`.
 * Per https://wiki.leagueoflegends.com/en-us/Armor#Penetration_and_reduction,
 * reductions are split proportionally between base and bonus resistance, so
 * the bonus share of the total is preserved through steps 1–2.
 */
export function calculateEffectiveResistance(
  totalResistance: number,
  pen: PenetrationStats = {},
  bonusResistance = 0,
): number {
  const {
    flatReduction = 0,
    percentReduction = 0,
    percentPen = 0,
    bonusPercentPen = 0,
    flatPen = 0,
  } = pen
  const bonusShare =
    totalResistance > 0 ? Math.min(1, Math.max(0, bonusResistance / totalResistance)) : 0

  // 1. Flat reduction (additive debuff, e.g. Black Cleaver shred stacks)
  let resistance = totalResistance - flatReduction

  // 2. Percent reduction (multiplicative debuff)
  resistance *= 1 - percentReduction

  // 3. Percent penetration, then bonus-only percent penetration on the bonus
  // share of what remains (does not apply to already-negative resistance)
  if (resistance > 0) {
    resistance *= (1 - percentPen) * (1 - bonusShare * bonusPercentPen)
  }

  // 4. Flat penetration, applied last. Per
  // https://wiki.leagueoflegends.com/en-us/Armor#Penetration_and_reduction:
  // penetration/reduction "cannot reduce a target's resistance below 0" —
  // meaning flat pen only ever pulls a *positive* resistance down toward 0
  // (clamped there), and has no further effect once resistance is already
  // <= 0 (it does not make an already-negative resistance more negative).
  if (resistance > 0) {
    return Math.max(0, resistance - flatPen)
  }
  return resistance
}

/** Converts a pre-mitigation (raw) damage value into post-mitigation damage
 * given an effective resistance value (already past penetration/reduction). */
export function applyMitigation(rawDamage: number, effectiveResistance: number): number {
  if (effectiveResistance >= 0) {
    return rawDamage / (1 + effectiveResistance / 100)
  }
  return rawDamage * (2 - 100 / (100 - effectiveResistance))
}

export type MitigationTarget = {
  readonly armor: number
  readonly magicResist: number
  /** Portion of `armor` / `magicResist` that is bonus. Defaults to 0. */
  readonly bonusArmor?: number
  readonly bonusMagicResist?: number
}

export type AttackerPenetration = {
  readonly armor?: PenetrationStats
  readonly magicResist?: PenetrationStats
}

export type MitigationResult = {
  readonly mitigatedDamage: number
  readonly effectiveResistance: number
}

/** High-level helper: given a raw damage amount, its damage type, the
 * target's base armor/magic resist, and the attacker's penetration stats,
 * returns post-mitigation damage plus the intermediate effective resistance.
 * `"true"` damage bypasses mitigation entirely. */
export function calculateMitigatedDamage(params: {
  readonly rawDamage: number
  readonly damageType: DamageType
  readonly target: MitigationTarget
  readonly attackerPen?: AttackerPenetration
}): MitigationResult {
  const { rawDamage, damageType, target, attackerPen = {} } = params
  if (damageType === "true") {
    return { mitigatedDamage: rawDamage, effectiveResistance: 0 }
  }

  const isPhysical = damageType === "physical"
  const totalResistance = isPhysical ? target.armor : target.magicResist
  const bonusResistance = (isPhysical ? target.bonusArmor : target.bonusMagicResist) ?? 0
  const pen = (isPhysical ? attackerPen.armor : attackerPen.magicResist) ?? {}

  const effectiveResistance = calculateEffectiveResistance(totalResistance, pen, bonusResistance)
  const mitigatedDamage = applyMitigation(rawDamage, effectiveResistance)

  return { mitigatedDamage, effectiveResistance }
}
