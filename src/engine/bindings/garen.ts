import type { ChampionData } from "../../data/snapshot-schema"
import type { ComboAction, Kit, PassiveRule } from "../sim/types"
import type { ResolvedStats } from "../stats/types"
import { abilityEvalContext, compileAbilityCalc, withAbilityData } from "./helpers"

/** Garen (key 86). Q (Decisive Strike) physical hit, E (Judgment) a 7-tick
 * spin (normal + crit variant), R (Demacian Justice) %missing-HP true damage
 * execute — Garen's chosen default mechanic per plan §1.
 *
 * E's `TotalDamage` calc is genuinely *per-tick*, not a flat hit —
 * https://wiki.leagueoflegends.com/en-us/Garen ("Template:Data
 * Garen/Judgment"): "Garen rapidly spins his sword around himself 7 (+1 per
 * 25% bonus attack speed) times over 3 seconds ... Physical Damage Per
 * Spin: 4/7/10/13/16 (+40/43/46/49/52% AD)" — matches `BaseDamagePerTick`/
 * `ADRatioPerTick` exactly. Modeled as `NumTicks` instant hits over the 3s
 * duration (bonus-AS-driven extra spins not modeled — documented
 * simplification, fixed tick count per rank). `CriticalDamage`'s raw calc
 * is `(sum of 0 parts) × (1 + productOfSubParts([]))` — the same
 * tooltip-helper-calc-referencing-a-sibling pattern as Darius's
 * `HandleDamage`/`MaximumDamage` and Yasuo's `BonusDamagePerStack` (always
 * evaluates to 0) — the crit variant is computed directly here as
 * `TotalDamage × (1 + CritMod)` per tick.
 *
 * R has **no** `mSpellCalculations` entry at all in the CDragon bin
 * (verified: `R.calcs = []`); its flat component + execute percent are read
 * directly off `R.dataValues.BaseDamage`/`ExecuteDamage` (binding override,
 * documented per plan §4.2). https://wiki.leagueoflegends.com/en-us/Garen —
 * "Demacian Justice deals true damage ... increased damage based on the
 * target's missing health." */
export function buildGarenKit(
  champion: ChampionData,
  level: number,
  stats: ResolvedStats,
  ranks: Partial<Record<"Q" | "E" | "R", number>>,
): Kit {
  const q = champion.abilities.Q
  const e = champion.abilities.E
  const r = champion.abilities.R
  const qRank = ranks.Q ?? q.maxRank
  const eRank = ranks.E ?? e.maxRank
  const rRank = ranks.R ?? r.maxRank

  const qTotal = withAbilityData(q, qRank, compileAbilityCalc(q, "TotalDamage"))
  const eTotal = withAbilityData(e, eRank, compileAbilityCalc(e, "TotalDamage"))
  const numTicks = e.dataValues.NumTicks?.[eRank] ?? 7
  const spinDurationMs = (e.dataValues.Duration?.[eRank] ?? 3) * 1000
  const tickIntervalMs = spinDurationMs / numTicks
  const critMod = e.dataValues.CritMod?.[eRank] ?? 0.3
  const rBase = r.dataValues.BaseDamage?.[rRank] ?? 0
  const rExecutePercent = r.dataValues.ExecuteDamage?.[rRank] ?? 0

  function judgmentAction(
    id: string,
    label: string,
    keyLabel: string,
    critMultiplier: number,
  ): ComboAction {
    return {
      id,
      label,
      keyLabel,
      slot: "E",
      damageType: "physical",
      modeled: true,
      castTimeMs: spinDurationMs,
      rank: eRank,
      forceCrit: false,
      components: [
        {
          id: "main",
          label,
          damageType: "physical",
          canCrit: false,
          compute: (ctx) => eTotal(ctx) * critMultiplier,
          isDot: { tickIntervalMs, ticks: numTicks },
        },
      ],
    }
  }

  const actions: ComboAction[] = [
    {
      id: "Q",
      label: "Decisive Strike (Q)",
      keyLabel: "Q",
      slot: "Q",
      damageType: "physical",
      modeled: true,
      castTimeMs: (q.castTime ?? 0.52) * 1000,
      rank: qRank,
      forceCrit: false,
      components: [
        {
          id: "main",
          label: "Decisive Strike",
          damageType: "physical",
          canCrit: false,
          compute: (ctx) => qTotal(ctx),
        },
      ],
    },
    judgmentAction("E", "Judgment (E)", "E", 1),
    judgmentAction("E-crit", "Judgment ✳ (crit)", "E✳", 1 + critMod),
    {
      id: "R",
      label: "Demacian Justice (R)",
      keyLabel: "R",
      slot: "R",
      damageType: "true",
      modeled: true,
      castTimeMs: (r.castTime ?? 0.44) * 1000,
      rank: rRank,
      forceCrit: false,
      components: [
        {
          id: "main",
          label: "Demacian Justice",
          damageType: "true",
          canCrit: false,
          compute: (_ctx, _time, target) =>
            rBase + rExecutePercent * Math.max(0, target.maxHp - target.currentHp),
        },
      ],
    },
    {
      id: "AA",
      label: "Auto Attack",
      keyLabel: "AA",
      slot: "AA",
      damageType: "physical",
      modeled: true,
      castTimeMs: 1000 / Math.max(0.01, stats.total.attackSpeed),
      rank: 1,
      forceCrit: false,
      components: [
        {
          id: "aa",
          label: "Attack Damage",
          damageType: "physical",
          canCrit: true,
          compute: (ctx) => ctx.stats.total.attackDamage,
        },
      ],
    },
  ]

  const passiveTriggers: PassiveRule[] = []
  const ctx = abilityEvalContext(stats, level, qRank, q)
  return { sourceId: "", championId: champion.id, level, ctx, actions, passiveTriggers }
}
