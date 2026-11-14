import { describe, expect, it } from "vitest"
import type { ComboStep, Kit, TargetSpec } from "@/engine"
import { simulate } from "@/engine"
import { buildComparisonRow } from "./comparison-row"
import { fixtureAction, fixtureKit } from "./test-support/fixtures"

function kitWithHit(raw: number): Kit {
  return fixtureKit({
    actions: [
      fixtureAction({
        id: "Q",
        components: [
          { id: "q", label: "Q", damageType: "physical", canCrit: false, compute: () => raw },
        ],
      }),
    ],
  })
}

function target(maxHp: number): TargetSpec {
  return { id: "t1", name: "Dummy", maxHp, bonusHp: 0, armor: 0, magicResist: 0 }
}

const COMBO = { comboId: "combo-1", comboName: "Combo", variantId: "is-1", variantName: "IE" }

describe("buildComparisonRow", () => {
  it("computes total/%HP/DPS for a non-lethal combo", () => {
    const steps: ComboStep[] = [{ id: "s1", sourceId: "src-a", actionId: "Q" }]
    const kits = { "src-a": kitWithHit(100) }
    const result = simulate({ steps, kits, target: target(1000) })

    const row = buildComparisonRow(COMBO, target(1000), result, steps)

    expect(row.total).toBe(100)
    expect(row.percentHp).toBeCloseTo(10)
    expect(row.killed).toBe(false)
    expect(row.killStepLabel).toBeNull()
    expect(row.physical).toBe(100)
  })

  it("reports the real killing step (not an engine placeholder) and overkill", () => {
    // Given a 2-step combo where the second step (a lethal 500 hit) kills a
    // 400-HP target
    const steps: ComboStep[] = [
      { id: "s1", sourceId: "src-a", actionId: "Q" },
      { id: "s2", sourceId: "src-a", actionId: "Q" },
    ]
    const kits = { "src-a": kitWithHit(500) }
    const result = simulate({ steps, kits, target: target(400) })

    const row = buildComparisonRow(COMBO, target(400), result, steps)

    expect(row.killed).toBe(true)
    expect(row.killStepLabel).toBe("Step 1")
    expect(row.overkill).toBe(100)
  })
})
