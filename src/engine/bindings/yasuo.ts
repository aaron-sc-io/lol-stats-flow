import type { ChampionData } from "../../data/snapshot-schema"
import type { EvalContext } from "../formula/types"
import type { ComboAction, Kit, PassiveRule } from "../sim/types"
import type { ResolvedStats } from "../stats/types"
import {
  abilityEvalContext,
  basicAttackCastTimeMs,
  compileAbilityCalc,
  withAbilityData,
} from "./helpers"

/** Buff counter set once Last Breath (R) has been cast. Per the 16.22
 * tooltip: "Afterwards, Yasuo's critical strikes ignore {{ rpercentarmorpen }}%
 * bonus Armor for {{ rbuffduration }} seconds" — crit autos and the crit
 * Steel Tempest get bonus-only percent armor pen, not full armor ignore. */
const LAST_BREATH_BUFF = "YasuoLastBreath"

/** Builds the post-R crit pen reader: 0 before R is cast, else the R
 * rank's `RPercentArmorPen` (60 → 0.6). */
function lastBreathBonusPen(percent: number): (ctx: EvalContext) => number {
  return (ctx) => ((ctx.buffCounters?.[LAST_BREATH_BUFF] ?? 0) > 0 ? percent : 0)
}

function aaAction(
  stats: ResolvedStats,
  crit: boolean,
  critBonusPen: (ctx: EvalContext) => number,
): ComboAction {
  return {
    id: crit ? "AA-crit" : "AA",
    label: crit ? "Auto Attack (crit)" : "Auto Attack",
    keyLabel: crit ? "AA✳" : "AA",
    slot: "AA",
    damageType: "physical",
    modeled: true,
    castTimeMs: basicAttackCastTimeMs(stats),
    rank: 1,
    forceCrit: crit,
    components: [
      {
        id: "aa",
        label: "Attack Damage",
        damageType: "physical",
        canCrit: true,
        compute: (ctx) => ctx.stats.total.attackDamage,
        ...(crit ? { bonusArmorPenPercent: critBonusPen } : {}),
      },
    ],
  }
}

/** Yasuo (key 157). Mechanics modeled: Q (Steel Tempest) normal + guaranteed
 * crit variant (`TotalDamageCrit` — Steel Tempest critical strike, whose own
 * compiled formula already bakes in `critDamageMultiplier` via its
 * `statBySubPart` shape; no engine `forceCrit` needed), E (Sweeping Blade)
 * base hit + per-stored-stack bonus (1-4 stacks, matching old lolstats'
 * E0-E4 convention per plan D9), R (Last Breath), AA + AA-crit. Passive
 * (shield on dodge-adjacent flow) deals no damage and is out of scope per
 * plan D15 (shields/healing on the attacker side are excluded). */
export function buildYasuoKit(
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
  const qCrit = withAbilityData(q, qRank, compileAbilityCalc(q, "TotalDamageCrit"))
  const eTotal = withAbilityData(e, eRank, compileAbilityCalc(e, "TotalDamage"))
  const rDamage = withAbilityData(r, rRank, compileAbilityCalc(r, "Damage"))
  // CDragon dataValue arrays are [rank0placeholder, rank1, ...] (compile.ts).
  const rPercentArmorPen = r.dataValues.RPercentArmorPen?.[rRank] ?? 60
  const critBonus = lastBreathBonusPen(rPercentArmorPen / 100)
  // `BonusDamagePerStack`'s raw shape is `(sum of 0 parts) * 0.25` — a
  // percentage-multiplier template, not a standalone damage value (same
  // pattern CDragon uses for Darius R's `MaximumDamage`). Its real meaning
  // per the live tooltip ("deals 25% increased damage per extra stored
  // Gathering Storm charge") is a multiplier on `TotalDamage` itself, so the
  // per-stack bonus percent is read directly off that multiplier constant.
  const eStackBonusPercent =
    e.calculations.BonusDamagePerStack?.multiplier?.kind === "number"
      ? e.calculations.BonusDamagePerStack.multiplier.value
      : 0.25

  const actions: ComboAction[] = [
    {
      id: "Q",
      label: "Steel Tempest (Q)",
      keyLabel: "Q",
      slot: "Q",
      damageType: "physical",
      modeled: true,
      castTimeMs: (q.castTime ?? 0.25) * 1000,
      rank: qRank,
      forceCrit: false,
      components: [
        {
          id: "q",
          label: "Steel Tempest",
          damageType: "physical",
          canCrit: false,
          compute: (ctx) => qTotal(ctx),
        },
      ],
    },
    {
      id: "Q-empowered",
      label: "Steel Tempest ✳ (crit)",
      keyLabel: "Q✳",
      slot: "Q",
      damageType: "physical",
      modeled: true,
      castTimeMs: (q.castTime ?? 0.25) * 1000,
      rank: qRank,
      forceCrit: false,
      components: [
        {
          id: "q-crit",
          label: "Steel Tempest (crit)",
          damageType: "physical",
          canCrit: false,
          compute: (ctx) => qCrit(ctx),
          bonusArmorPenPercent: critBonus,
        },
      ],
    },
    {
      id: "E",
      label: "Sweeping Blade (E)",
      keyLabel: "E",
      slot: "E",
      damageType: "magic",
      modeled: true,
      castTimeMs: (e.castTime ?? 0.25) * 1000,
      rank: eRank,
      forceCrit: false,
      components: [
        {
          id: "e",
          label: "Sweeping Blade",
          damageType: "magic",
          canCrit: false,
          compute: (ctx) => eTotal(ctx),
        },
      ],
    },
    ...[1, 2, 3, 4].map(
      (n): ComboAction => ({
        id: `E-stack${n}`,
        label: `Sweeping Blade (E, ${n} stored stacks)`,
        keyLabel: `E${n}`,
        slot: "E",
        damageType: "magic",
        modeled: true,
        castTimeMs: (e.castTime ?? 0.25) * 1000,
        rank: eRank,
        forceCrit: false,
        components: [
          {
            id: "e",
            label: "Sweeping Blade",
            damageType: "magic",
            canCrit: false,
            compute: (ctx) => eTotal(ctx) * (1 + eStackBonusPercent * n),
          },
        ],
      }),
    ),
    {
      id: "R",
      label: "Last Breath (R)",
      keyLabel: "R",
      slot: "R",
      damageType: "physical",
      modeled: true,
      castTimeMs: (r.castTime ?? 0.25) * 1000,
      rank: rRank,
      forceCrit: false,
      components: [
        {
          id: "r",
          label: "Last Breath",
          damageType: "physical",
          canCrit: false,
          compute: (ctx) => rDamage(ctx),
        },
      ],
    },
    aaAction(stats, false, critBonus),
    aaAction(stats, true, critBonus),
  ]

  const passiveTriggers: PassiveRule[] = [
    {
      id: "yasuo-last-breath-bonus-armor-pen",
      appliesTo: (event) => event.action.id === "R",
      effect: (api, event) => api.setBuffCounter(event.sourceId, LAST_BREATH_BUFF, 1),
    },
  ]
  const ctx = abilityEvalContext(stats, level, qRank, q)
  return { sourceId: "", championId: champion.id, level, ctx, actions, passiveTriggers }
}
