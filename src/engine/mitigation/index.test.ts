import { describe, expect, it } from "vitest"
import {
  applyMitigation,
  calculateEffectiveResistance,
  calculateMitigatedDamage,
  lethalityToArmorPen,
} from "./index"

describe("calculateEffectiveResistance", () => {
  it("Given positive armor and no penetration, when resolved, then it returns the base value unchanged", () => {
    expect(calculateEffectiveResistance(100)).toBe(100)
  })

  it("Given flat and percent reduction, when resolved, then they apply additively-then-multiplicatively before penetration", () => {
    // (100 - 10) * (1 - 0.3) = 63
    expect(
      calculateEffectiveResistance(100, { flatReduction: 10, percentReduction: 0.3 }),
    ).toBeCloseTo(63)
  })

  it("Given percent penetration after reduction, when resolved, then it multiplies the already-reduced value", () => {
    // 63 * (1 - 0.3) = 44.1
    expect(
      calculateEffectiveResistance(100, {
        flatReduction: 10,
        percentReduction: 0.3,
        percentPen: 0.3,
      }),
    ).toBeCloseTo(44.1)
  })

  it("Given flat penetration applied last, when it would exceed the remaining resistance, then effective resistance clamps at 0 (never negative)", () => {
    expect(calculateEffectiveResistance(10, { flatPen: 50 })).toBe(0)
  })

  it("Given negative base resistance, when percent and flat penetration are applied, then neither has any further effect (penetration cannot push an already-negative resistance more negative)", () => {
    expect(calculateEffectiveResistance(-20, { percentPen: 0.5, flatPen: 5 })).toBe(-20)
  })
})

describe("applyMitigation", () => {
  it("Given 100 armor, when mitigating 100 raw damage, then post-mitigation damage is 50 (100 / (1 + 100/100))", () => {
    expect(applyMitigation(100, 100)).toBeCloseTo(50)
  })

  it("Given 0 effective resistance, when mitigating, then raw damage passes through unchanged", () => {
    expect(applyMitigation(100, 0)).toBe(100)
  })

  it("Given negative effective resistance (e.g. -50), when mitigating, then damage is amplified per the negative-resist formula", () => {
    // 100 * (2 - 100/(100-(-50))) = 100 * (2 - 100/150) = 133.33...
    expect(applyMitigation(100, -50)).toBeCloseTo(133.333, 2)
  })
})

describe("lethalityToArmorPen", () => {
  it("Given level 18, when converting lethality, then it is a 1:1 conversion", () => {
    expect(lethalityToArmorPen(18, 18)).toBeCloseTo(18)
  })

  it("Given level 1, when converting lethality, then only 62.2% of lethality becomes armor pen", () => {
    expect(lethalityToArmorPen(18, 1)).toBeCloseTo(18 * 0.622, 2)
  })

  it("Given zero lethality, when converting, then it returns 0 regardless of level", () => {
    expect(lethalityToArmorPen(0, 18)).toBe(0)
  })
})

describe("calculateMitigatedDamage", () => {
  it("Given true damage, when mitigated, then it bypasses resistance entirely", () => {
    const result = calculateMitigatedDamage({
      rawDamage: 100,
      damageType: "true",
      target: { armor: 9999, magicResist: 9999 },
    })
    expect(result).toEqual({ mitigatedDamage: 100, effectiveResistance: 0 })
  })

  it("Given physical damage against 100 armor target, when mitigated, then it reads armor (not magic resist)", () => {
    const result = calculateMitigatedDamage({
      rawDamage: 100,
      damageType: "physical",
      target: { armor: 100, magicResist: 0 },
    })
    expect(result.mitigatedDamage).toBeCloseTo(50)
    expect(result.effectiveResistance).toBe(100)
  })

  it("Given magic damage with flat + percent magic pen, when mitigated, then attackerPen.magicResist is applied (armor pen ignored)", () => {
    const result = calculateMitigatedDamage({
      rawDamage: 100,
      damageType: "magic",
      target: { armor: 500, magicResist: 100 },
      attackerPen: {
        armor: { flatPen: 9999 },
        magicResist: { percentPen: 0.4, flatPen: 10 },
      },
    })
    // (100 * 0.6) - 10 = 50 effective MR
    expect(result.effectiveResistance).toBeCloseTo(50)
    expect(result.mitigatedDamage).toBeCloseTo(100 / 1.5)
  })
})
