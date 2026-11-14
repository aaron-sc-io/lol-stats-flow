import { describe, expect, it } from "vitest"
import type { ComboStep, Kit, TargetSpec } from "@/engine"
import { getOrSimulate } from "./sim-cache"
import { fixtureAction, fixtureKit } from "./test-support/fixtures"

function target(overrides: Partial<TargetSpec> = {}): TargetSpec {
  return {
    id: "t1",
    name: "Dummy",
    maxHp: 1000,
    bonusHp: 0,
    armor: 0,
    magicResist: 0,
    ...overrides,
  }
}

function flatHitKit(raw: number): Kit {
  return fixtureKit({
    actions: [
      fixtureAction({
        id: "Q",
        components: [
          {
            id: "q",
            label: "Q",
            damageType: "physical",
            canCrit: false,
            compute: () => raw,
          },
        ],
      }),
    ],
  })
}

function oneStep(): ComboStep[] {
  return [{ id: "s1", sourceId: "src-a", actionId: "Q" }]
}

describe("getOrSimulate", () => {
  it("simulates a flat physical hit against a 0-armor target unmitigated", () => {
    const result = getOrSimulate(oneStep(), { "src-a": flatHitKit(100) }, target())
    expect(result.totalsByType.physical).toBe(100)
  })

  it("memoizes: equal-value (but different object reference) inputs return the same SimResult", () => {
    const kits = { "src-a": flatHitKit(100) }
    const first = getOrSimulate(oneStep(), kits, target())
    const second = getOrSimulate(oneStep(), kits, target())
    expect(first).toBe(second)
  })

  it("invalidates when the target's resistance changes", () => {
    const kits = { "src-a": flatHitKit(100) }
    const noArmor = getOrSimulate(oneStep(), kits, target({ armor: 0 }))
    const withArmor = getOrSimulate(oneStep(), kits, target({ armor: 100 }))
    expect(withArmor).not.toBe(noArmor)
    expect(withArmor.totalsByType.physical).toBeLessThan(noArmor.totalsByType.physical)
  })

  it("invalidates when the steps list changes", () => {
    const kits = { "src-a": flatHitKit(100) }
    const single = getOrSimulate(oneStep(), kits, target())
    const double = getOrSimulate(
      [...oneStep(), { id: "s2", sourceId: "src-a", actionId: "Q" }],
      kits,
      target(),
    )
    expect(double.totalsByType.physical).toBeGreaterThan(single.totalsByType.physical)
  })

  it("invalidates when a kit is swapped for a different instance (e.g. an item changed)", () => {
    const steps = oneStep()
    const weaker = getOrSimulate(steps, { "src-a": flatHitKit(100) }, target())
    const stronger = getOrSimulate(steps, { "src-a": flatHitKit(200) }, target())
    expect(stronger.totalsByType.physical).toBeGreaterThan(weaker.totalsByType.physical)
  })
})
