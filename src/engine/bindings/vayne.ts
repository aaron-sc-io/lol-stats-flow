import type { ChampionData } from "../../data/snapshot-schema"
import { advanceStackCounter } from "../effects/primitives"
import type { ComboAction, Kit, PassiveRule } from "../sim/types"
import type { ResolvedStats } from "../stats/types"
import {
  abilityEvalContext,
  basicAttackCastTimeMs,
  compileAbilityCalc,
  withAbilityData,
} from "./helpers"

const STACK_STATE_KEY = "VayneW"

/** Vayne (key 67). Q (Tumble) on-hit AD-ratio bonus, E (Condemn) + empowered
 * stun-vs-wall variant, W (Silver Bolts, also usable as its own combo step)
 * + automatic every-3rd-hit passive proc, AA/AA-crit.
 *
 * W's real formula is `max(DamageFloor[rank], MaxHealthRatio[rank] *
 * target.maxHp)` — https://wiki.leagueoflegends.com/en-us/Vayne
 * ("Template:Data Vayne/Silver_Bolts"): "Bonus True Damage: 4/5.5/7/8.5/10%
 * of target's maximum health", "Minimum Bonus Damage: 40/55/70/85/100". The
 * compiled `W.TotalDamage` calc's own output is the *fraction*
 * (`displayAsPercent: true`), not a flat number, and the floor isn't in any
 * calc at all — both are combined directly off `W.dataValues` here (same
 * %maxHp-fraction pattern as Brand's `ExplosionDamage`).
 *
 * E's `EmpoweredDamageTT` (wall-collision bonus) raw calc is `(sum of 0
 * parts) × namedDataValue(StunDamage)` (always evaluates to 0 — the same
 * tooltip-helper-calc pattern as Darius/Garen/Yasuo); the real bonus is
 * `TotalDamage(ctx) × StunDamage` (a constant 1.5× multiplier), matching
 * "Template:Data Vayne/Condemn": "Bonus Physical Damage: 75/127.5/180/
 * 232.5/285 (+75% bonus AD)" = exactly 1.5× the normal hit's "50/85/120/
 * 155/190 (+50% bonus AD)" at every rank.
 *
 * Plan §1's chosen default for Vayne (every-3rd-hit true %max-HP) is
 * modeled via a `StackCounter` primitive (`advanceStackCounter`) firing on
 * every 3rd Q/AA hit. */
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
  const eTotal = withAbilityData(e, eRank, compileAbilityCalc(e, "TotalDamage"))
  const wDamageFloor = w.dataValues.DamageFloor?.[wRank] ?? 0
  const wMaxHealthRatio = w.dataValues.MaxHealthRatio?.[wRank] ?? 0
  const stunDamageMultiplier = e.dataValues.StunDamage?.[eRank] ?? 1.5
  const silverBolts = (targetMaxHp: number) => Math.max(wDamageFloor, wMaxHealthRatio * targetMaxHp)

  const silverBoltsTrigger: PassiveRule = {
    id: "vayne-silver-bolts",
    appliesTo: (event) => event.action.slot === "AA" || event.action.id === "Q",
    effect: (api, event) => {
      const state = { hits: api.getBuffCounter(event.sourceId, STACK_STATE_KEY) }
      const { state: next, triggered } = advanceStackCounter(state, 3)
      api.setBuffCounter(event.sourceId, STACK_STATE_KEY, next.hits)
      if (triggered) {
        api.scheduleBonusHit(
          event.sourceId,
          "Silver Bolts",
          "true",
          silverBolts(api.getTargetState().maxHp),
          0,
        )
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
      id: "W",
      label: "Silver Bolts (W)",
      keyLabel: "W",
      slot: "W",
      damageType: "true",
      modeled: true,
      castTimeMs: 0,
      rank: wRank,
      forceCrit: false,
      components: [
        {
          id: "main",
          label: "Silver Bolts",
          damageType: "true",
          canCrit: false,
          compute: (_ctx, _time, target) => silverBolts(target.maxHp),
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
          compute: (ctx) => eTotal(ctx) * stunDamageMultiplier,
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
      castTimeMs: basicAttackCastTimeMs(stats),
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
      castTimeMs: basicAttackCastTimeMs(stats),
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
