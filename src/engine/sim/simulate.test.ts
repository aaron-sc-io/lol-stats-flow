import { describe, expect, it } from "vitest"
import type { EvalContext } from "../formula/types"
import { simulate } from "./simulate"
import type { ComboAction, Kit, PassiveRule, TargetSpec } from "./types"

function fixtureCtx(overrides: Partial<EvalContext["stats"]["total"]> = {}): EvalContext {
  return {
    level: 11,
    rank: 1,
    dataValues: {},
    stats: {
      level: 11,
      base: { health: 0, armor: 0, magicResist: 0, attackDamage: 0, abilityPower: 0 },
      bonus: { health: 0, armor: 0, magicResist: 0, attackDamage: 0, abilityPower: 0 },
      total: {
        health: 0,
        armor: 0,
        magicResist: 0,
        attackDamage: 0,
        abilityPower: 0,
        attackSpeed: 1,
        criticalStrikeChance: 0,
        criticalStrikeDamageMultiplier: 2,
        abilityHaste: 0,
        armorPenetrationFlat: 0,
        armorPenetrationPercent: 0,
        magicPenetrationFlat: 0,
        magicPenetrationPercent: 0,
        physicalLethality: 0,
        lifeSteal: 0,
        omnivamp: 0,
        ...overrides,
      },
      attackSpeedRatio: 1,
    },
  }
}

function hitAction(id: string, damage: number, opts: Partial<ComboAction> = {}): ComboAction {
  return {
    id,
    label: id,
    keyLabel: id,
    slot: "Q",
    damageType: "physical",
    modeled: true,
    castTimeMs: 0,
    rank: 1,
    forceCrit: false,
    components: [
      { id: "main", label: id, damageType: "physical", canCrit: false, compute: () => damage },
    ],
    ...opts,
  }
}

function basicTarget(overrides: Partial<TargetSpec> = {}): TargetSpec {
  return {
    id: "t1",
    name: "Dummy",
    maxHp: 1000,
    armor: 0,
    magicResist: 0,
    bonusHp: 0,
    ...overrides,
  }
}

describe("simulate — order of operations", () => {
  it("Given a single hit with no resistance, when simulated, then mitigated equals raw and HP decreases by that amount", () => {
    const kit: Kit = {
      sourceId: "s1",
      championId: null,
      level: 11,
      ctx: fixtureCtx(),
      actions: [hitAction("Q", 100)],
      passiveTriggers: [],
    }
    const result = simulate({
      steps: [{ id: "step1", sourceId: "s1", actionId: "Q" }],
      kits: { s1: kit },
      target: basicTarget(),
    })
    expect(result.instances).toHaveLength(1)
    expect(result.instances[0]?.mitigated).toBeCloseTo(100)
    expect(result.totalsByType.physical).toBeCloseTo(100)
  })

  it("Given forceCrit on a canCrit component, when simulated, then damage is multiplied by critDamageMultiplier", () => {
    const action = hitAction("Q-crit", 100, {
      forceCrit: true,
      components: [
        { id: "main", label: "Q", damageType: "physical", canCrit: true, compute: () => 100 },
      ],
    })
    const kit: Kit = {
      sourceId: "s1",
      championId: null,
      level: 11,
      ctx: fixtureCtx({ criticalStrikeDamageMultiplier: 2.3 }),
      actions: [action],
      passiveTriggers: [],
    }
    const result = simulate({
      steps: [{ id: "s", sourceId: "s1", actionId: "Q-crit" }],
      kits: { s1: kit },
      target: basicTarget(),
    })
    expect(result.instances[0]?.raw).toBeCloseTo(230)
  })

  it("Given a DoT action, when simulated, then ticks are scheduled as separate interleaved instances after the hit", () => {
    const action: ComboAction = {
      id: "burn",
      label: "Burn",
      keyLabel: "P",
      slot: "Q",
      damageType: "magic",
      modeled: true,
      castTimeMs: 0,
      rank: 1,
      forceCrit: false,
      components: [
        {
          id: "main",
          label: "Burn",
          damageType: "magic",
          canCrit: false,
          compute: () => 10,
          isDot: { tickIntervalMs: 500, ticks: 3 },
        },
      ],
    }
    const kit: Kit = {
      sourceId: "s1",
      championId: null,
      level: 1,
      ctx: fixtureCtx(),
      actions: [action],
      passiveTriggers: [],
    }
    const result = simulate({
      steps: [{ id: "s", sourceId: "s1", actionId: "burn" }],
      kits: { s1: kit },
      target: basicTarget(),
    })
    expect(result.instances).toHaveLength(3)
    expect(result.instances.every((i) => i.isTick)).toBe(true)
    expect(result.instances.map((i) => i.time)).toEqual([500, 1000, 1500])
  })

  it("Given a %current-HP component, when a prior hit already reduced HP, then the percent reads post-hit HP (resolve-time state, not pre-combat)", () => {
    const burstAction = hitAction("burst", 500)
    const percentAction: ComboAction = {
      id: "siphon",
      label: "Siphon",
      keyLabel: "AA",
      slot: "AA",
      damageType: "physical",
      modeled: true,
      castTimeMs: 0,
      rank: 1,
      forceCrit: false,
      components: [
        {
          id: "main",
          label: "Siphon",
          damageType: "physical",
          canCrit: false,
          compute: (_ctx, _t, target) => target.currentHp * 0.1,
        },
      ],
    }
    const kit: Kit = {
      sourceId: "s1",
      championId: null,
      level: 1,
      ctx: fixtureCtx(),
      actions: [burstAction, percentAction],
      passiveTriggers: [],
    }
    const result = simulate({
      steps: [
        { id: "a", sourceId: "s1", actionId: "burst" },
        { id: "b", sourceId: "s1", actionId: "siphon" },
      ],
      kits: { s1: kit },
      target: basicTarget({ maxHp: 1000 }),
    })
    // after burst: 1000-500=500; siphon = 10% of 500 = 50 (not 10% of original 1000)
    expect(result.instances[1]?.raw).toBeCloseTo(50)
  })

  it("Given a kill mid-combo, when a later step fires, then HP clamps at 0, overkill is recorded, and later hits deal no further damage", () => {
    const kit: Kit = {
      sourceId: "s1",
      championId: null,
      level: 1,
      ctx: fixtureCtx(),
      actions: [hitAction("big", 1500), hitAction("extra", 999)],
      passiveTriggers: [],
    }
    const result = simulate({
      steps: [
        { id: "a", sourceId: "s1", actionId: "big" },
        { id: "b", sourceId: "s1", actionId: "extra" },
      ],
      kits: { s1: kit },
      target: basicTarget({ maxHp: 1000 }),
    })
    expect(result.killedAt).toEqual({ stepId: "a", time: 0 })
    expect(result.overkill).toBeCloseTo(500)
    expect(result.instances).toHaveLength(1)
    expect(result.instances[0]?.targetHpAfter).toBe(0)
  })

  it("Given two sources targeting the same dummy, when simulated, then both sources' damage reduces the same shared target HP", () => {
    const kitA: Kit = {
      sourceId: "a",
      championId: null,
      level: 1,
      ctx: fixtureCtx(),
      actions: [hitAction("hit", 300)],
      passiveTriggers: [],
    }
    const kitB: Kit = {
      sourceId: "b",
      championId: null,
      level: 1,
      ctx: fixtureCtx(),
      actions: [hitAction("hit", 200)],
      passiveTriggers: [],
    }
    const result = simulate({
      steps: [
        { id: "s1", sourceId: "a", actionId: "hit" },
        { id: "s2", sourceId: "b", actionId: "hit" },
      ],
      kits: { a: kitA, b: kitB },
      target: basicTarget({ maxHp: 1000 }),
    })
    expect(result.instances[0]?.targetHpAfter).toBeCloseTo(700)
    expect(result.instances[1]?.targetHpAfter).toBeCloseTo(500)
  })

  it("Given a resist-reduction passive trigger (Black Cleaver-style shred), when a later hit resolves, then it reads reduced effective armor", () => {
    const rule: PassiveRule = {
      id: "shred",
      appliesTo: (event) => event.action.id === "shredHit",
      effect: (api) => api.addResistShred("armor", 10, "flat"),
    }
    const shredAction = hitAction("shredHit", 100)
    const followUp = hitAction("followUp", 100)
    const kit: Kit = {
      sourceId: "s1",
      championId: null,
      level: 1,
      ctx: fixtureCtx(),
      actions: [shredAction, followUp],
      passiveTriggers: [rule],
    }
    const result = simulate({
      steps: [
        { id: "a", sourceId: "s1", actionId: "shredHit" },
        { id: "b", sourceId: "s1", actionId: "followUp" },
      ],
      kits: { s1: kit },
      target: basicTarget({ armor: 20 }),
    })
    // first hit at 20 armor: 100/(1+0.2)=83.33
    expect(result.instances[0]?.mitigated).toBeCloseTo(83.33, 1)
    // second hit at (20-10)=10 armor: 100/(1+0.1)=90.9
    expect(result.instances[1]?.mitigated).toBeCloseTo(90.9, 1)
  })

  it("Given a spellblade passive (ability arms it, next AA consumes it), when the AA fires, then a bonus on-hit instance is scheduled", () => {
    const abilityAction = hitAction("Q", 0)
    const aaAction = hitAction("AA", 50)
    const rule: PassiveRule = {
      id: "spellblade",
      appliesTo: () => true,
      effect: (api, event) => {
        if (event.action.id === "Q") {
          api.armSpellblade(event.sourceId, () => 80)
        } else if (event.action.id === "AA") {
          const formula = api.consumeSpellblade(event.sourceId)
          if (formula !== null) {
            api.scheduleBonusHit(event.sourceId, "Sheen proc", "physical", formula(api.ctx), 0)
          }
        }
      },
    }
    const kit: Kit = {
      sourceId: "s1",
      championId: null,
      level: 1,
      ctx: fixtureCtx(),
      actions: [abilityAction, aaAction],
      passiveTriggers: [rule],
    }
    const result = simulate({
      steps: [
        { id: "a", sourceId: "s1", actionId: "Q" },
        { id: "b", sourceId: "s1", actionId: "AA" },
      ],
      kits: { s1: kit },
      target: basicTarget(),
    })
    expect(result.instances.some((i) => i.label === "Sheen proc" && i.raw === 80)).toBe(true)
  })

  it("Given negative target resistance, when mitigated, then damage amplifies per the negative-resist formula (shared mitigation module)", () => {
    const kit: Kit = {
      sourceId: "s1",
      championId: null,
      level: 1,
      ctx: fixtureCtx(),
      actions: [hitAction("Q", 100)],
      passiveTriggers: [],
    }
    const result = simulate({
      steps: [{ id: "s", sourceId: "s1", actionId: "Q" }],
      kits: { s1: kit },
      target: basicTarget({ armor: -50 }),
    })
    expect(result.instances[0]?.mitigated).toBeCloseTo(133.33, 1)
  })

  it("Given a DoT re-applied (same sourceId+label) before its previous ticks finish, when simulated, then the old DoT's unfired ticks are cancelled and only the refreshed stream's ticks fire (no parallel streams)", () => {
    const applyBurn: PassiveRule = {
      id: "burn",
      appliesTo: () => true,
      effect: (api, event) => api.scheduleDot(event.sourceId, "Burn", "magic", () => 10, 500, 4), // 4 ticks @ 500ms = fires at +500,+1000,+1500,+2000
    }
    const hit1 = hitAction("hit1", 0)
    const hit2 = hitAction("hit2", 0)
    const kit: Kit = {
      sourceId: "s1",
      championId: null,
      level: 1,
      ctx: fixtureCtx(),
      actions: [hit1, hit2],
      passiveTriggers: [applyBurn],
    }
    // hit1 fires at t=0 (arms a 4-tick burn at 500/1000/1500/2000).
    // hit2 fires at t=0 too (castTimeMs=0 for both, same source -> sequential
    // cursor advances castTimeMs=0 so both fire at t=0) - force a delay so
    // the second application happens mid-stream, at t=700 (between tick 1
    // and tick 2 of the first application).
    const result = simulate({
      steps: [
        { id: "a", sourceId: "s1", actionId: "hit1" },
        { id: "b", sourceId: "s1", actionId: "hit2", delayMs: 700 },
      ],
      kits: { s1: kit },
      target: basicTarget({ maxHp: 10000 }),
    })
    const burnTicks = result.instances.filter((i) => i.label === "Burn")
    // Only tick times: 500 (from 1st application, before refresh at 700),
    // then refreshed stream from 700: 1200, 1700, 2200, 2700. Total = 1 + 4 = 5,
    // NEVER the un-refreshed 8 (4 old + 4 new) a naive "always schedule" bug would produce.
    expect(burnTicks).toHaveLength(5)
    expect(burnTicks.map((i) => i.time)).toEqual([500, 1200, 1700, 2200, 2700])
  })

  it("Given two DIFFERENT sources applying DoTs with the same label, when simulated, then each source's DoT refreshes independently (keyed by sourceId+label, not label alone)", () => {
    const applyBurn: PassiveRule = {
      id: "burn",
      appliesTo: () => true,
      effect: (api, event) => api.scheduleDot(event.sourceId, "Burn", "magic", () => 10, 500, 2),
    }
    const kitA: Kit = {
      sourceId: "a",
      championId: null,
      level: 1,
      ctx: fixtureCtx(),
      actions: [hitAction("hit", 0)],
      passiveTriggers: [applyBurn],
    }
    const kitB: Kit = {
      sourceId: "b",
      championId: null,
      level: 1,
      ctx: fixtureCtx(),
      actions: [hitAction("hit", 0)],
      passiveTriggers: [applyBurn],
    }
    const result = simulate({
      steps: [
        { id: "a1", sourceId: "a", actionId: "hit" },
        { id: "b1", sourceId: "b", actionId: "hit" },
      ],
      kits: { a: kitA, b: kitB },
      target: basicTarget({ maxHp: 10000 }),
    })
    const burnTicks = result.instances.filter((i) => i.label === "Burn")
    // Both sources' 2-tick DoTs fire independently: 4 ticks total, not merged/cancelled.
    expect(burnTicks).toHaveLength(4)
  })
})
