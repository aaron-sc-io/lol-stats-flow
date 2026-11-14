import type { ChampionData } from "../../data/snapshot-schema"
import type { ComboAction, Kit, PassiveRule } from "../sim/types"
import type { ResolvedStats } from "../stats/types"
import { abilityEvalContext, compileAbilityCalc, withAbilityData } from "./helpers"

const ABLAZE_COUNTER = "BrandAblaze"

/** Brand (key 63). Q/W/E/R main damage (all magic, AP ratios). Passive
 * (Blaze): every ability hit "ablazes" the target; a second ability hit
 * while ablaze detonates it for bonus true damage (`ExplosionDamage`).
 * Modeled as a buff-counter passive trigger that fires on every Q/W/E/R hit:
 * first hit sets the counter, a hit while already set schedules the
 * detonation and clears it (https://wiki.leagueoflegends.com/en-us/Brand —
 * "Blaze" passive, patch 16.22 wording: "deals ... bonus damage and ignites
 * them ... if the target is already ablaze, this spell instead detonates
 * the blaze"). `EmpoweredDamage` (W bonus vs ablaze) is bound separately. */
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
      const ablaze = api.getBuffCounter(event.sourceId, ABLAZE_COUNTER)
      if (ablaze > 0) {
        api.scheduleBonusHit(event.sourceId, "Blaze detonation", "true", explosion(api.ctx), 0)
        api.setBuffCounter(event.sourceId, ABLAZE_COUNTER, 0)
      } else {
        api.setBuffCounter(event.sourceId, ABLAZE_COUNTER, 1)
      }
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
