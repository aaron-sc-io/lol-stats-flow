import type { ChampionData } from "../../data/snapshot-schema"
import type { ComboAction, Kit, PassiveRule } from "../sim/types"
import type { ResolvedStats } from "../stats/types"
import { abilityEvalContext, compileAbilityCalc, withAbilityData } from "./helpers"

/** Garen (key 86). Q (Decisive Strike) physical hit, E (Judgment) spin
 * normal + crit variant, R (Demacian Justice) %missing-HP true damage
 * execute — Garen's chosen default mechanic per plan §1. R has **no**
 * `mSpellCalculations` entry at all in the CDragon bin (verified: `R.calcs
 * = []`); its flat component + execute percent are read directly off
 * `R.dataValues.BaseDamage`/`ExecuteDamage` (binding override, documented
 * per plan §4.2) and combined via the engine's `PercentHp` primitive
 * (variant "missing") rather than a compiled `FormulaNode`.
 * https://wiki.leagueoflegends.com/en-us/Garen — "Demacian Justice deals
 * true damage ... increased damage based on the target's missing health." */
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
  const eCrit = withAbilityData(e, eRank, compileAbilityCalc(e, "CriticalDamage"))
  const rBase = r.dataValues.BaseDamage?.[rRank] ?? 0
  const rExecutePercent = r.dataValues.ExecuteDamage?.[rRank] ?? 0

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
    {
      id: "E",
      label: "Judgment (E)",
      keyLabel: "E",
      slot: "E",
      damageType: "physical",
      modeled: true,
      castTimeMs: 1500,
      rank: eRank,
      forceCrit: false,
      components: [
        {
          id: "main",
          label: "Judgment",
          damageType: "physical",
          canCrit: false,
          compute: (ctx) => eTotal(ctx),
        },
      ],
    },
    {
      id: "E-crit",
      label: "Judgment ✳ (crit)",
      keyLabel: "E✳",
      slot: "E",
      damageType: "physical",
      modeled: true,
      castTimeMs: 1500,
      rank: eRank,
      forceCrit: false,
      components: [
        {
          id: "main",
          label: "Judgment (crit)",
          damageType: "physical",
          canCrit: false,
          compute: (ctx) => eCrit(ctx),
        },
      ],
    },
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
