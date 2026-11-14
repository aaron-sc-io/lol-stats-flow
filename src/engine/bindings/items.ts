import type { ItemData } from "../../data/snapshot-schema"
import { advanceStackCounter } from "../effects/primitives"
import { compileCalculation } from "../formula/compile"
import type { CompiledFormula, EvalContext } from "../formula/types"
import type { ComboAction, PassiveRule } from "../sim/types"

function find(items: readonly ItemData[], name: string): ItemData | undefined {
  return items.find((i) => i.name === name)
}

/** Item passives/actives are unranked — their `dataValues` are plain
 * numbers, not per-rank arrays — so calcs are bound with rank fixed at 1
 * and every data value wrapped as a length-1 array. */
function withItemData(
  dataValues: Readonly<Record<string, number>>,
  formula: CompiledFormula,
): CompiledFormula {
  const wrapped = Object.fromEntries(Object.entries(dataValues).map(([k, v]) => [k, [v]]))
  return (ctx) => formula({ ...ctx, dataValues: wrapped, rank: 1 })
}

/** Item passive mechanics not already covered by `statsAt`'s stat
 * aggregation (Rabadon's AP amp, Void Staff/LDR's %pen are plain stat
 * fields — no binding needed here). Sources cited per item. */
export function buildItemPassiveTriggers(
  items: readonly ItemData[],
  isMelee: boolean,
): PassiveRule[] {
  const rules: PassiveRule[] = []

  const blackCleaver = find(items, "Black Cleaver")
  if (blackCleaver !== undefined) {
    const shredPerStack = blackCleaver.passivesAndActives[0]?.dataValues.ShredPerStack ?? 0.06
    const maxStacks = blackCleaver.passivesAndActives[0]?.dataValues.MaxStacks ?? 5
    // https://wiki.leagueoflegends.com/en-us/Black_Cleaver — "Carve: ...
    // reduces the target's Armor by 6%, stacking up to 5 times" (30% total).
    rules.push({
      id: "black-cleaver-carve",
      appliesTo: (event) => event.action.damageType === "physical",
      effect: (api, event) => {
        const stacks = api.getBuffCounter(event.sourceId, "BlackCleaverStacks")
        if (stacks < maxStacks) {
          api.setBuffCounter(event.sourceId, "BlackCleaverStacks", stacks + 1)
          api.addResistShred("armor", shredPerStack, "percent")
        }
      },
    })
  }

  const liandrys = find(items, "Liandry's Torment")
  if (liandrys !== undefined) {
    const dv = liandrys.passivesAndActives[0]?.dataValues ?? {}
    const burnPercent = dv.BurnPercentHealthDamage ?? 0.02
    const tickFrequency = dv.TickFrequency ?? 0.5
    const duration = dv.BurnDuration ?? 3
    const ticks = Math.max(1, Math.round(duration / tickFrequency))
    // https://wiki.leagueoflegends.com/en-us/Liandry%27s_Torment — "Torment:
    // ...deals magic damage over 3 seconds equal to 2% of the target's
    // maximum health per second." (Damage ramp vs long fights not modeled —
    // documented gap: `DamageIncreasePerSecond`/`Max` are not applied here.)
    rules.push({
      id: "liandrys-burn",
      appliesTo: (event) =>
        event.action.slot === "Q" ||
        event.action.slot === "W" ||
        event.action.slot === "E" ||
        event.action.slot === "R",
      effect: (api, event) => {
        const maxHp = api.getTargetState().maxHp
        api.scheduleDot(
          event.sourceId,
          "Liandry's Torment",
          "magic",
          () => (burnPercent / ticks) * duration * maxHp,
          tickFrequency * 1000,
          ticks,
        )
      },
    })
  }

  const bork = find(items, "Blade of The Ruined King")
  if (bork !== undefined) {
    const dv = bork.passivesAndActives[0]?.dataValues ?? {}
    const percent = isMelee ? (dv.MeleeValue ?? 0.09) : (dv.RangedValue ?? 0.06)
    // https://wiki.leagueoflegends.com/en-us/Blade_of_the_Ruined_King —
    // "Mist's Edge: ...on-hit...dealing physical damage equal to 9% (melee)
    // / 6% (ranged) of the target's current Health".
    rules.push({
      id: "bork-on-hit",
      appliesTo: (event) => event.action.slot === "AA",
      effect: (api, event) => {
        const target = api.getTargetState()
        api.scheduleBonusHit(
          event.sourceId,
          "Blade of The Ruined King",
          "physical",
          percent * target.currentHp,
          0,
        )
      },
    })
  }

  const kraken = find(items, "Kraken Slayer")
  if (kraken !== undefined) {
    const calc = kraken.passivesAndActives[0]?.calculations.DamageAmount
    const attackCount = kraken.passivesAndActives[0]?.dataValues.AttackCount ?? 3
    const rangedMult = kraken.passivesAndActives[0]?.dataValues.RangedDamageMultiplier ?? 0.8
    if (calc !== undefined) {
      const damageFn = withItemData(
        kraken.passivesAndActives[0]?.dataValues ?? {},
        compileCalculation(calc),
      )
      // https://wiki.leagueoflegends.com/en-us/Kraken_Slayer — "Bring It
      // Down: Every 3rd basic attack deals bonus true damage."
      rules.push({
        id: "kraken-every-3rd",
        appliesTo: (event) => event.action.slot === "AA",
        effect: (api, event) => {
          const state = { hits: api.getBuffCounter(event.sourceId, "KrakenHits") }
          const { state: next, triggered } = advanceStackCounter(state, attackCount)
          api.setBuffCounter(event.sourceId, "KrakenHits", next.hits)
          if (triggered) {
            const base = damageFn(api.ctx as EvalContext)
            const raw = isMelee ? base : base * rangedMult
            api.scheduleBonusHit(event.sourceId, "Kraken Slayer", "true", raw, 0)
          }
        },
      })
    }
  }

  for (const spellbladeName of ["Sheen", "Trinity Force"]) {
    const item = find(items, spellbladeName)
    const calc = item?.passivesAndActives[0]?.calculations.SpellbladeDamage
    if (item !== undefined && calc !== undefined) {
      const formula = withItemData(
        item.passivesAndActives[0]?.dataValues ?? {},
        compileCalculation(calc),
      )
      // https://wiki.leagueoflegends.com/en-us/Sheen /
      // https://wiki.leagueoflegends.com/en-us/Trinity_Force — "Spellblade:
      // after using an ability, your next attack deals bonus physical
      // damage (100% base AD for Sheen, 200% for Trinity Force)."
      rules.push({
        id: `${item.id}-spellblade-arm`,
        appliesTo: (event) =>
          event.action.slot === "Q" ||
          event.action.slot === "W" ||
          event.action.slot === "E" ||
          event.action.slot === "R",
        effect: (api, event) => api.armSpellblade(event.sourceId, formula),
      })
      rules.push({
        id: `${item.id}-spellblade-consume`,
        appliesTo: (event) => event.action.slot === "AA",
        effect: (api, event) => {
          const armed = api.consumeSpellblade(event.sourceId)
          if (armed !== null) {
            api.scheduleBonusHit(
              event.sourceId,
              `${spellbladeName} (Spellblade)`,
              "physical",
              armed(api.ctx as EvalContext),
              0,
            )
          }
        },
      })
    }
  }

  return rules
}

/** Item actives usable as their own combo step (plan §4.3 `Active`). */
export function buildItemActions(items: readonly ItemData[]): ComboAction[] {
  const actions: ComboAction[] = []
  const rocketbelt = find(items, "Hextech Rocketbelt")
  const rocketbeltCalc = rocketbelt?.passivesAndActives[0]?.calculations.FireboltDamage
  if (rocketbelt !== undefined && rocketbeltCalc !== undefined) {
    const damageFn = withItemData(
      rocketbelt.passivesAndActives[0]?.dataValues ?? {},
      compileCalculation(rocketbeltCalc),
    )
    // https://wiki.leagueoflegends.com/en-us/Hextech_Rocketbelt — "Supersonic:
    // ...dealing magic damage."
    actions.push({
      id: "item-rocketbelt",
      label: "Hextech Rocketbelt (active)",
      keyLabel: "Rocketbelt",
      slot: "ITEM",
      damageType: "magic",
      modeled: true,
      castTimeMs: 250,
      rank: 1,
      forceCrit: false,
      components: [
        {
          id: "main",
          label: "Hextech Rocketbelt",
          damageType: "magic",
          canCrit: false,
          compute: (ctx) => damageFn(ctx as EvalContext),
        },
      ],
    })
  }
  return actions
}
