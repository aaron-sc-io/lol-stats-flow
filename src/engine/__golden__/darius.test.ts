import { describe, expect, it } from "vitest"
import { buildKit } from "../kit"
import { simulate } from "../sim/simulate"
import { loadSnapshotFixture } from "../test-support/load-snapshot"

const snapshot = loadSnapshotFixture()
const dummy = (maxHp: number, armor: number, magicResist: number) => ({
  id: "dummy",
  name: "Dummy",
  maxHp,
  armor,
  magicResist,
  bonusHp: 0,
})

/** Golden tests for Darius, hand-verified against
 * https://wiki.leagueoflegends.com/en-us/Darius (retrieved 2026-11-14,
 * "Template:Data Darius/Decimate"): "Physical Damage (Blade): 50 / 80 / 110
 * / 140 / 170 (+ 100 / 110 / 120 / 130 / 140% AD)" and "Reduced Damage
 * (Handle): 17.5 / 28 / 38.5 / 49 / 59.5 (+ 35 / 38.5 / 42 / 45.5 / 49% AD)"
 * — Handle is exactly 35% of Blade at every rank, confirmed arithmetically
 * (17.5/50 = 28/80 = ... = 0.35 at every rank/ratio pair). The snapshot's
 * `HandleDamage` calc is `(sum of 0 parts) × 0.35` (always evaluates to 0 —
 * the same "tooltip-helper calc referencing a sibling" pattern documented
 * for Darius R's `MaximumDamage` and Yasuo E's `BonusDamagePerStack`), and
 * `BladeDamage`'s own `TotalADRatio` term is wrapped in an empty
 * `productOfSubParts` (evaluates to the constant 1 = 100% at every rank,
 * not the real rank-scaled 100/110/120/130/140%) — both are binding
 * overrides computed directly off `Q.dataValues` here, never the broken
 * compiled calcs. */
describe("Darius golden — level 1, rank 1, no items", () => {
  const kit = buildKit(snapshot, {
    championId: "Darius",
    level: 1,
    items: [],
    rankOverrides: { Q: 1 },
  })
  // Level 1 total AD = 64 base (no growth yet).
  const totalAD = 64

  it("Q blade rank 1: wiki = 50 (+100% AD) = 50 + 1.0*totalAD", () => {
    const result = simulate({
      steps: [{ id: "s", sourceId: "Darius", actionId: "Q-blade" }],
      kits: { Darius: kit },
      target: dummy(2000, 0, 0),
    })
    expect(result.instances[0]?.raw).toBeCloseTo(50 + 1.0 * totalAD)
  })

  it("Q handle rank 1: wiki = 17.5 (+35% AD) = exactly 35% of blade's raw damage", () => {
    const bladeResult = simulate({
      steps: [{ id: "s", sourceId: "Darius", actionId: "Q-blade" }],
      kits: { Darius: kit },
      target: dummy(2000, 0, 0),
    })
    const handleResult = simulate({
      steps: [{ id: "s", sourceId: "Darius", actionId: "Q-handle" }],
      kits: { Darius: kit },
      target: dummy(2000, 0, 0),
    })
    expect(handleResult.instances[0]?.raw).toBeCloseTo((bladeResult.instances[0]?.raw ?? 0) * 0.35)
    expect(handleResult.instances[0]?.raw).toBeCloseTo(17.5 + 0.35 * totalAD)
  })
})

describe("Darius golden — level 11, rank 5, with Black Cleaver, vs 100 armor / 100 MR target", () => {
  const kit = buildKit(snapshot, {
    championId: "Darius",
    level: 11,
    items: ["Black Cleaver"],
    rankOverrides: { Q: 5 },
  })
  // Level 11: growthMultiplier(11) = 10*(0.7025+0.0175*10) = 10*0.8775 = 8.775
  // total AD = 64 (base) + 5*8.775 (growth) + 45 (Black Cleaver flat AD) = 152.875
  const totalAD = 64 + 5 * 8.775 + 45

  it("Q blade rank 5: wiki = 170 (+140% AD); ratio must use the real rank-5 value (140%), not the empty-productOfSubParts constant (100%)", () => {
    const result = simulate({
      steps: [{ id: "s", sourceId: "Darius", actionId: "Q-blade" }],
      kits: { Darius: kit },
      target: dummy(2000, 100, 100),
    })
    const expectedRaw = 170 + 1.4 * totalAD
    expect(result.instances[0]?.raw).toBeCloseTo(expectedRaw, 1)
    expect(result.instances[0]?.mitigated).toBeCloseTo(expectedRaw / 2, 1)
  })

  it("Q handle rank 5: must stay exactly 35% of blade at every rank (wiki: 59.5 = 0.35*170, 49% = 0.35*140%)", () => {
    const bladeResult = simulate({
      steps: [{ id: "s", sourceId: "Darius", actionId: "Q-blade" }],
      kits: { Darius: kit },
      target: dummy(2000, 0, 0),
    })
    const handleResult = simulate({
      steps: [{ id: "s", sourceId: "Darius", actionId: "Q-handle" }],
      kits: { Darius: kit },
      target: dummy(2000, 0, 0),
    })
    expect(handleResult.instances[0]?.raw).toBeCloseTo(
      (bladeResult.instances[0]?.raw ?? 0) * 0.35,
      1,
    )
  })
})
