import type { ChampionData } from "../../data/snapshot-schema"
import { advanceStackCounter } from "../effects/primitives"
import type { ComboAction, Kit, PassiveRule } from "../sim/types"
import type { ResolvedStats } from "../stats/types"
import { abilityEvalContext, compileAbilityCalc, withAbilityData } from "./helpers"

const STACK_STATE_KEY = "VayneW"

/** Vayne (key 67). Q (Tumble) on-hit AD-ratio bonus, E (Condemn) + empowered
 * stun-vs-wall variant, AA/AA-crit. Passive + W (Silver Bolts): Vayne's
 * every-3rd-hit true %max-HP mechanic is plan §1's chosen default for her —
 * modeled here as a `StackCounter` primitive (`advanceStackCounter`) that
 * fires `W.TotalDamage` (true damage, `%MaxHealthRatio` + `DamageFloor`) on
 * every 3rd Q/AA hit. https://wiki.leagueoflegends.com/en-us/Vayne —
 * "Silver Bolts: ...dealing...bonus true damage" every 3rd consecutive
 * attack on the same target. */
export function buildVayneKit(
  champion: ChampionData,
  level: number,
  stats: ResolvedStats,
  ranks: Partial<Record<"Q" | "W" | "E", number>>,
): Kit {
  const q = champion.abilities.Q
  const w = champion.abilities.W
  const e = champion.abilities.E
  const qRank = ranks.Q ?? q.maxRank
  const wRank = ranks.W ?? w.maxRank
  const eRank = ranks.E ?? e.maxRank

  const qBonus = withAbilityData(q, qRank, compileAbilityCalc(q, "ADRatioBonus"))
  const wTotal = withAbilityData(w, wRank, compileAbilityCalc(w, "TotalDamage"))
  const eTotal = withAbilityData(e, eRank, compileAbilityCalc(e, "TotalDamage"))
  const eEmpowered = withAbilityData(e, eRank, compileAbilityCalc(e, "EmpoweredDamageTT"))

  const silverBoltsTrigger: PassiveRule = {
    id: "vayne-silver-bolts",
    appliesTo: (event) => event.action.slot === "AA" || event.action.id === "Q",
    effect: (api, event) => {
      const state = { hits: api.getBuffCounter(event.sourceId, STACK_STATE_KEY) }
      const { state: next, triggered } = advanceStackCounter(state, 3)
      api.setBuffCounter(event.sourceId, STACK_STATE_KEY, next.hits)
      if (triggered) {
        api.scheduleBonusHit(event.sourceId, "Silver Bolts", "true", wTotal(api.ctx), 0)
      }
    },
  }

  const actions: ComboAction[] = [
    {
      id: "Q",
      label: "Tumble (Q, on-hit bonus)",
      keyLabel: "Q",
      slot: "Q",
      damageType: "physical",
      modeled: true,
      castTimeMs: (q.castTime ?? 0.25) * 1000,
      rank: qRank,
      forceCrit: false,
      components: [
        {
          id: "aa",
          label: "Attack Damage",
          damageType: "physical",
          canCrit: true,
          compute: (ctx) => ctx.stats.total.attackDamage,
        },
        {
          id: "bonus",
          label: "Tumble bonus",
          damageType: "physical",
          canCrit: false,
          compute: (ctx) => qBonus(ctx),
        },
      ],
    },
    {
      id: "E",
      label: "Condemn (E)",
      keyLabel: "E",
      slot: "E",
      damageType: "physical",
      modeled: true,
      castTimeMs: (e.castTime ?? 0.25) * 1000,
      rank: eRank,
      forceCrit: false,
      components: [
        {
          id: "main",
          label: "Condemn",
          damageType: "physical",
          canCrit: false,
          compute: (ctx) => eTotal(ctx),
        },
      ],
    },
    {
      id: "E-empowered",
      label: "Condemn ✳ (vs wall)",
      keyLabel: "E✳",
      slot: "E",
      damageType: "physical",
      modeled: true,
      castTimeMs: (e.castTime ?? 0.25) * 1000,
      rank: eRank,
      forceCrit: false,
      components: [
        {
          id: "main",
          label: "Condemn",
          damageType: "physical",
          canCrit: false,
          compute: (ctx) => eTotal(ctx),
        },
        {
          id: "wall-bonus",
          label: "Condemn (wall bonus)",
          damageType: "physical",
          canCrit: false,
          compute: (ctx) => eEmpowered(ctx),
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
    {
      id: "AA-crit",
      label: "Auto Attack (crit)",
      keyLabel: "AA✳",
      slot: "AA",
      damageType: "physical",
      modeled: true,
      castTimeMs: 1000 / Math.max(0.01, stats.total.attackSpeed),
      rank: 1,
      forceCrit: true,
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

  const ctx = abilityEvalContext(stats, level, qRank, q)
  return {
    sourceId: "",
    championId: champion.id,
    level,
    ctx,
    actions,
    passiveTriggers: [silverBoltsTrigger],
  }
}
