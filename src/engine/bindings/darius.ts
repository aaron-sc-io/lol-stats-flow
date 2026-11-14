import type { ChampionData } from "../../data/snapshot-schema"
import type { ComboAction, Kit, PassiveRule } from "../sim/types"
import type { ResolvedStats } from "../stats/types"
import { abilityEvalContext, compileAbilityCalc, withAbilityData } from "./helpers"

const BLEED_COUNTER = "DariusBleed"

/** Darius (key 122). Q (Decimate) blade/handle components, W (Crippling
 * Strike) empowered-AA bonus, R (Noxian Guillotine) execute scaled by
 * current Hemorrhage stacks, AA/AA-crit. Passive (Hemorrhage): modeled as a
 * stacking physical bleed DoT applied by Q and AA hits (plan's chosen
 * default "stacking physical bleed DoT (passive)"), capped at
 * `P.dataValues.MaxStacks` (5) — https://wiki.leagueoflegends.com/en-us/
 * Darius#Hemorrhage. R's `RDamagePercentPerHemoStack` bonus is NOT present
 * in the compiled `Damage`/`MaximumDamage` calcs (verified: `MaximumDamage`
 * is `0 * 2` — a tooltip-only helper, not a real stack-scaled formula), so
 * the stack bonus is applied here directly off the live bleed-stack count
 * (binding override, documented per plan §4.2 "bindings decide what is
 * simulated"). */
export function buildDariusKit(
  champion: ChampionData,
  level: number,
  stats: ResolvedStats,
  ranks: Partial<Record<"Q" | "W" | "R", number>>,
): Kit {
  const p = champion.abilities.P
  const q = champion.abilities.Q
  const w = champion.abilities.W
  const r = champion.abilities.R
  const qRank = ranks.Q ?? q.maxRank
  const wRank = ranks.W ?? w.maxRank
  const rRank = ranks.R ?? r.maxRank

  const blade = withAbilityData(q, qRank, compileAbilityCalc(q, "BladeDamage"))
  const handle = withAbilityData(q, qRank, compileAbilityCalc(q, "HandleDamage"))
  const empoweredAA = withAbilityData(w, wRank, compileAbilityCalc(w, "EmpoweredAttackDamage"))
  const rDamage = withAbilityData(r, rRank, compileAbilityCalc(r, "Damage"))
  const bleedPerStack = withAbilityData(p, 1, compileAbilityCalc(p, "BleedDamagePerStack"))
  const maxStacks = p.dataValues.MaxStacks?.[0] ?? 5
  const bleedDuration = p.dataValues.BleedDuration?.[0] ?? 5
  const secondsPerTick = p.dataValues.SecondsPerTick?.[0] ?? 1
  const rStackPercent = r.dataValues.RDamagePercentPerHemoStack?.[rRank] ?? 0

  const applyBleedStack: PassiveRule = {
    id: "darius-bleed",
    appliesTo: (event) =>
      event.action.id === "Q-blade" || event.action.id === "Q-handle" || event.action.id === "AA",
    effect: (api, event) => {
      const stacks = Math.min(maxStacks, api.getBuffCounter(event.sourceId, BLEED_COUNTER) + 1)
      api.setBuffCounter(event.sourceId, BLEED_COUNTER, stacks)
      const ticks = Math.max(1, Math.round(bleedDuration / secondsPerTick))
      api.scheduleDot(
        event.sourceId,
        "Hemorrhage",
        "physical",
        (ctx) => bleedPerStack(ctx) * stacks,
        secondsPerTick * 1000,
        ticks,
      )
    },
  }

  const actions: ComboAction[] = [
    {
      id: "Q-blade",
      label: "Decimate (Q, blade)",
      keyLabel: "Q",
      slot: "Q",
      damageType: "physical",
      modeled: true,
      castTimeMs: (q.castTime ?? 0.25) * 1000,
      rank: qRank,
      forceCrit: false,
      components: [
        {
          id: "main",
          label: "Decimate (blade)",
          damageType: "physical",
          canCrit: false,
          compute: (ctx) => blade(ctx),
        },
      ],
    },
    {
      id: "Q-handle",
      label: "Decimate (Q, handle)",
      keyLabel: "Q",
      slot: "Q",
      damageType: "physical",
      modeled: true,
      castTimeMs: (q.castTime ?? 0.25) * 1000,
      rank: qRank,
      forceCrit: false,
      components: [
        {
          id: "main",
          label: "Decimate (handle)",
          damageType: "physical",
          canCrit: false,
          compute: (ctx) => handle(ctx),
        },
      ],
    },
    {
      id: "W",
      label: "Crippling Strike (W, empowered AA)",
      keyLabel: "W",
      slot: "W",
      damageType: "physical",
      modeled: true,
      castTimeMs: (w.castTime ?? 0.5) * 1000,
      rank: wRank,
      forceCrit: false,
      components: [
        {
          id: "main",
          label: "Crippling Strike",
          damageType: "physical",
          canCrit: false,
          compute: (ctx) => empoweredAA(ctx),
        },
      ],
    },
    {
      id: "R",
      label: "Noxian Guillotine (R)",
      keyLabel: "R",
      slot: "R",
      damageType: "true",
      modeled: true,
      castTimeMs: (r.castTime ?? 0.25) * 1000,
      rank: rRank,
      forceCrit: false,
      components: [
        {
          id: "main",
          label: "Noxian Guillotine",
          damageType: "true",
          canCrit: false,
          compute: (ctx) => {
            const stacks = ctx.buffCounters?.[BLEED_COUNTER] ?? 0
            return rDamage(ctx) * (1 + stacks * rStackPercent)
          },
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

  const ctx = abilityEvalContext(stats, level, qRank, q)
  return {
    sourceId: "",
    championId: champion.id,
    level,
    ctx,
    actions,
    passiveTriggers: [applyBleedStack],
  }
}
