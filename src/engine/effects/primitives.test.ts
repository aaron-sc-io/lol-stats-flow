import { describe, expect, it } from "vitest"
import {
  advanceStackCounter,
  applyResistReductionStack,
  resolveAmplifierMultiplier,
  resolveExecute,
  resolvePercentHp,
} from "./primitives"
import type { AmplifierEffect, ExecuteEffect, PercentHpEffect } from "./types"

const ctx = {} as never

describe("resolvePercentHp", () => {
  it("Given variant=current, when resolved, then it reads the target's current HP at resolve time (BotRK-style)", () => {
    const effect: PercentHpEffect = {
      kind: "percentHp",
      damageType: "physical",
      variant: "current",
      percentFormula: () => 0.1,
    }
    expect(resolvePercentHp(effect, ctx, { currentHp: 800, maxHp: 2000, bonusHp: 0 })).toBeCloseTo(
      80,
    )
  })

  it("Given variant=missing, when resolved, then it reads (maxHp - currentHp) (Garen R-style)", () => {
    const effect: PercentHpEffect = {
      kind: "percentHp",
      damageType: "true",
      variant: "missing",
      percentFormula: () => 0.3,
    }
    expect(resolvePercentHp(effect, ctx, { currentHp: 500, maxHp: 2000, bonusHp: 0 })).toBeCloseTo(
      0.3 * 1500,
    )
  })

  it("Given variant=max, when resolved, then it reads maxHp (Liandry-style DoT tick)", () => {
    const effect: PercentHpEffect = {
      kind: "percentHp",
      damageType: "magic",
      variant: "max",
      percentFormula: () => 0.02,
    }
    expect(resolvePercentHp(effect, ctx, { currentHp: 1, maxHp: 2000, bonusHp: 0 })).toBeCloseTo(40)
  })
})

describe("resolveExecute", () => {
  const effect: ExecuteEffect = {
    kind: "execute",
    damageType: "true",
    thresholdPercent: 0.2,
    normalFormula: () => 100,
    executeFormula: () => 9999,
  }

  it("Given target HP above the threshold, when resolved, then the normal formula applies", () => {
    expect(resolveExecute(effect, ctx, { currentHp: 500, maxHp: 1000, bonusHp: 0 })).toBe(100)
  })

  it("Given target HP at or below the threshold, when resolved, then the execute formula applies instead", () => {
    expect(resolveExecute(effect, ctx, { currentHp: 150, maxHp: 1000, bonusHp: 0 })).toBe(9999)
  })
})

describe("resolveAmplifierMultiplier", () => {
  it("Given scope=allDamage, when resolved for any damage type, then it always applies", () => {
    const effect: AmplifierEffect = {
      kind: "amplifier",
      scope: "allDamage",
      percentFormula: () => 0.1,
    }
    expect(resolveAmplifierMultiplier(effect, ctx, 0, "physical", false)).toBeCloseTo(1.1)
    expect(resolveAmplifierMultiplier(effect, ctx, 0, "true", true)).toBeCloseTo(1.1)
  })

  it("Given scope=abilityDamage, when resolved for an on-hit instance, then it does not apply (returns 1)", () => {
    const effect: AmplifierEffect = {
      kind: "amplifier",
      scope: "abilityDamage",
      percentFormula: () => 0.5,
    }
    expect(resolveAmplifierMultiplier(effect, ctx, 0, "magic", true)).toBe(1)
  })

  it("Given scope=onHitDamage, when resolved for ability damage, then it does not apply (returns 1)", () => {
    const effect: AmplifierEffect = {
      kind: "amplifier",
      scope: "onHitDamage",
      percentFormula: () => 0.5,
    }
    expect(resolveAmplifierMultiplier(effect, ctx, 0, "physical", false)).toBe(1)
  })

  it("Given a time-dependent amp (Riftmaker ramp), when resolved at a later elapsed time, then the multiplier grows", () => {
    const effect: AmplifierEffect = {
      kind: "amplifier",
      scope: "allDamage",
      percentFormula: (_ctx, elapsedMs) => Math.min(0.2, (elapsedMs / 1000) * 0.02),
    }
    expect(resolveAmplifierMultiplier(effect, ctx, 1_000, "magic", false)).toBeCloseTo(1.02)
    expect(resolveAmplifierMultiplier(effect, ctx, 20_000, "magic", false)).toBeCloseTo(1.2)
  })
})

describe("advanceStackCounter (every-Nth-hit trigger — Vayne W / Kraken Slayer)", () => {
  it("Given everyN=3, when hitting twice, then it does not trigger", () => {
    let state = { hits: 0 }
    let result = advanceStackCounter(state, 3)
    state = result.state
    expect(result.triggered).toBe(false)
    result = advanceStackCounter(state, 3)
    expect(result.triggered).toBe(false)
  })

  it("Given everyN=3, when hitting a third time, then it triggers and resets the counter", () => {
    const state = { hits: 2 }
    const result = advanceStackCounter(state, 3)
    expect(result.triggered).toBe(true)
    expect(result.state.hits).toBe(0)
  })
})

describe("applyResistReductionStack (Black Cleaver shred)", () => {
  it("Given stacks below max, when applied, then stacks increment by one", () => {
    expect(applyResistReductionStack({ stacks: 2 }, 6).stacks).toBe(3)
  })

  it("Given stacks already at max, when applied again, then stacks clamp (do not exceed max)", () => {
    expect(applyResistReductionStack({ stacks: 6 }, 6).stacks).toBe(6)
  })
})
