import type { ChampionData } from "../../data/snapshot-schema"
import type { ComboAction, Kit, PassiveRule } from "../sim/types"
import type { ResolvedStats } from "../stats/types"
import { abilityEvalContext, compileAbilityCalc, withAbilityData } from "./helpers"

const ABLAZE_COUNTER = "BrandAblaze"
const MAX_ABLAZE_STACKS = 3
/** Ablaze burn tick cadence/duration per
 * https://wiki.leagueoflegends.com/en-us/Brand ("Template:Data Brand/Blaze"):
 * "2% of their maximum health over 4 seconds ... every 0.25 seconds". No
 * dataValue carries these (duration/cadence aren't in `P.dataValues`), so
 * they're hardcoded here, cited to the wiki. */
const ABLAZE_TICK_INTERVAL_MS = 250
const ABLAZE_DURATION_MS = 4000
const ABLAZE_TICKS = ABLAZE_DURATION_MS / ABLAZE_TICK_INTERVAL_MS

/** Brand (key 63). Q/W/E/R main damage (all magic, AP ratios). Passive
 * (Blaze): every ability hit applies a stack of Ablaze (up to 3, refreshing
 * all stacks' duration on each application) and starts/refreshes a burn DoT
 * dealing magic damage over time. At 3 stacks, the target instead detonates
 * for a burst of magic damage equal to `P.ExplosionDamage`'s *fraction* of
 * target max HP (see module doc comment — the calc's own output is a
 * fraction like 0.06, not a flat number, and must be multiplied by
 * `target.maxHp`). Sources: https://wiki.leagueoflegends.com/en-us/Brand
 * ("Blaze" passive — "stacking up to 3 times", "dealt magic damage equal to
 * 2% of their maximum health over 4 seconds", "[detonation] dealt magic
 * damage equal to 6% – 12% (based on level) (+ 2% per 100 AP)").
 * `EmpoweredDamage` (W bonus vs ablaze) is bound separately. */
export function buildBrandKit(
  champion: ChampionData,
  level: number,
  stats: ResolvedStats,
  ranks: Partial<Record<"Q" | "W" | "E" | "R", number>>,
): Kit {
  const q = champion.abilities.Q
  const w = champion.abilities.W
  const e = champion.abilities.E
  const r = champion.abilities.R
  const p = champion.abilities.P
  const qRank = ranks.Q ?? q.maxRank
  const wRank = ranks.W ?? w.maxRank
  const eRank = ranks.E ?? e.maxRank
  const rRank = ranks.R ?? r.maxRank

  const qTotal = withAbilityData(q, qRank, compileAbilityCalc(q, "TotalDamage"))
  const wTotal = withAbilityData(w, wRank, compileAbilityCalc(w, "TotalDamage"))
  const wEmpowered = withAbilityData(w, wRank, compileAbilityCalc(w, "EmpoweredDamage"))
  const eTotal = withAbilityData(e, eRank, compileAbilityCalc(e, "EDamageCalc"))
  const rTotal = withAbilityData(r, rRank, compileAbilityCalc(r, "TotalDamage"))
  const explosion = withAbilityData(p, 1, compileAbilityCalc(p, "ExplosionDamage"))
  // P.dataValues.PercentHealthDamage is a plain percent number (2 = 2%), not
  // a fraction — divide by 100 before using as a %maxHp multiplier.
  const burnPercentOverDuration = (p.dataValues.PercentHealthDamage?.[0] ?? 2) / 100

  function hit(
    id: string,
    label: string,
    keyLabel: string,
    slot: "Q" | "W" | "E" | "R",
    rank: number,
    castTime: number | null,
    formula: ReturnType<typeof withAbilityData>,
  ): ComboAction {
    return {
      id,
      label,
      keyLabel,
      slot,
      damageType: "magic",
      modeled: true,
      castTimeMs: (castTime ?? 0.25) * 1000,
      rank,
      forceCrit: false,
      components: [
        { id: "main", label, damageType: "magic", canCrit: false, compute: (ctx) => formula(ctx) },
      ],
    }
  }

  const ablazeTrigger: PassiveRule = {
    id: "brand-blaze",
    appliesTo: (event) =>
      event.action.slot === "Q" ||
      event.action.slot === "W" ||
      event.action.slot === "E" ||
      event.action.slot === "R",
    effect: (api, event) => {
      const stacks = Math.min(
        MAX_ABLAZE_STACKS,
        api.getBuffCounter(event.sourceId, ABLAZE_COUNTER) + 1,
      )
      api.setBuffCounter(event.sourceId, ABLAZE_COUNTER, stacks)
      if (stacks >= MAX_ABLAZE_STACKS) {
        const targetMaxHp = api.getTargetState().maxHp
        api.scheduleBonusHit(
          event.sourceId,
          "Blaze detonation",
          "magic",
          explosion(api.ctx) * targetMaxHp,
          0,
        )
        api.setBuffCounter(event.sourceId, ABLAZE_COUNTER, 0)
        return
      }
      // Burn DoT: this engine merges all live Ablaze stacks into one
      // duration-refreshing stream (see module doc comment) whose per-tick
      // value scales with the current stack count, rather than the real
      // game's per-stack-independent ticking.
      const targetMaxHp = api.getTargetState().maxHp
      const perTickValue = (burnPercentOverDuration / ABLAZE_TICKS) * stacks * targetMaxHp
      api.scheduleDot(
        event.sourceId,
        "Ablaze",
        "magic",
        () => perTickValue,
        ABLAZE_TICK_INTERVAL_MS,
        ABLAZE_TICKS,
      )
    },
  }

  const actions: ComboAction[] = [
    hit("Q", "Sear (Q)", "Q", "Q", qRank, q.castTime, qTotal),
    hit("W", "Pillar of Flame (W)", "W", "W", wRank, w.castTime, wTotal),
    hit("W-empowered", "Pillar of Flame ✳ (vs ablaze)", "W✳", "W", wRank, w.castTime, wEmpowered),
    hit("E", "Conflagration (E)", "E", "E", eRank, e.castTime, eTotal),
    hit("R", "Pyroclasm (R)", "R", "R", rRank, r.castTime, rTotal),
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
    passiveTriggers: [ablazeTrigger],
  }
}
