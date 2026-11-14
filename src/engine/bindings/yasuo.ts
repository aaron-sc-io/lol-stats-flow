import type { ChampionData } from "../../data/snapshot-schema"
import type { ComboAction, Kit, PassiveRule } from "../sim/types"
import type { ResolvedStats } from "../stats/types"
import { abilityEvalContext, compileAbilityCalc, withAbilityData } from "./helpers"

function aaAction(stats: ResolvedStats, crit: boolean): ComboAction {
  return {
    id: crit ? "AA-crit" : "AA",
    label: crit ? "Auto Attack (crit)" : "Auto Attack",
    keyLabel: crit ? "AA✳" : "AA",
    slot: "AA",
    damageType: "physical",
    modeled: true,
    castTimeMs: 1000 / Math.max(0.01, stats.total.attackSpeed),
    rank: 1,
    forceCrit: crit,
    components: [
      {
        id: "aa",
        label: "Attack Damage",
        damageType: "physical",
        canCrit: true,
        compute: (ctx) => ctx.stats.total.attackDamage,
      },
    ],
  }
}

/** Yasuo (key 157). Mechanics modeled: Q (Steel Tempest) normal + guaranteed
 * crit variant (`TotalDamageCrit` — the third/tornado cast, whose own
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
      label: "Steel Tempest ✳ (tornado)",
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
    aaAction(stats, false),
    aaAction(stats, true),
  ]

  const passiveTriggers: PassiveRule[] = []
  const ctx = abilityEvalContext(stats, level, qRank, q)
  return { sourceId: "", championId: champion.id, level, ctx, actions, passiveTriggers }
}
