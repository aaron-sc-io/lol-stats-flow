import { describe, expect, it } from "vitest"
import type { ComboStep, Kit, PassiveRule, TargetSpec } from "@/engine"
import { simulate } from "@/engine"
import { buildChartPoints } from "./chart-points"
import { fixtureAction, fixtureKit } from "./test-support/fixtures"

/** Brand-with-Liandry's-shaped fixture: a single Q step that deals a flat
 * physical hit AND triggers a 3-tick magic DoT via a passive rule — the
 * same `scheduleDot` path real item/passive bindings use, which is exactly
 * where the engine's `stepId: "dot"` placeholder gap (documented in
 * `step-timing.ts`) shows up. */
function kitWithDot(): Kit {
  const dotRule: PassiveRule = {
    id: "test-dot",
    appliesTo: (event) => event.action.id === "Q",
    effect: (api, event) => {
      api.scheduleDot(event.sourceId, "Test DoT", "magic", () => 10, 500, 3)
    },
  }
  return fixtureKit({
    actions: [
      fixtureAction({
        id: "Q",
        castTimeMs: 250,
        components: [
          { id: "q", label: "Q", damageType: "physical", canCrit: false, compute: () => 50 },
        ],
      }),
    ],
    passiveTriggers: [dotRule],
  })
}

function target(): TargetSpec {
  return { id: "t1", name: "Dummy", maxHp: 1000, bonusHp: 0, armor: 0, magicResist: 0 }
}

describe("buildChartPoints", () => {
  const steps: ComboStep[] = [{ id: "s1", sourceId: "src-a", actionId: "Q" }]
  const kits = { "src-a": kitWithDot() }
  const result = simulate({ steps, kits, target: target() })

  it("step mode folds the DoT's 3 ticks into the single step that caused them", () => {
    const points = buildChartPoints(result, steps, kits, target(), "step")

    expect(points).toHaveLength(1)
    const point = points[0]
    expect(point?.physical).toBe(50)
    expect(point?.magic).toBe(30) // 3 ticks * 10
    expect(point?.total).toBe(80)
    expect(point?.cumulative).toBe(80)
  })

  it("tick mode renders every instance (the hit + 3 ticks) as its own point in time order", () => {
    const points = buildChartPoints(result, steps, kits, target(), "tick")

    expect(points).toHaveLength(4)
    expect(points.map((p) => p.x)).toEqual([0, 0.5, 1, 1.5])
    expect(points[0]?.physical).toBe(50)
    expect(points[1]?.magic).toBe(10)
    expect(points.at(-1)?.cumulative).toBe(80)
  })

  it("switching from step to tick mode strictly increases the point count when DoTs are present", () => {
    const stepPoints = buildChartPoints(result, steps, kits, target(), "step")
    const tickPoints = buildChartPoints(result, steps, kits, target(), "tick")
    expect(tickPoints.length).toBeGreaterThan(stepPoints.length)
  })
})
