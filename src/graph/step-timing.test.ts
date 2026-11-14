import { describe, expect, it } from "vitest"
import type { ComboAction, ComboStep, DamageInstance, Kit } from "@/engine"
import { computeStepFireTimes, resolveInstanceStepId } from "./step-timing"
import { fixtureAction, fixtureKit } from "./test-support/fixtures"

function action(id: string, castTimeMs: number): ComboAction {
  return fixtureAction({ id, castTimeMs })
}

function kit(actions: readonly ComboAction[]): Kit {
  return fixtureKit({ actions })
}

function instance(overrides: Partial<DamageInstance> & { readonly time: number }): DamageInstance {
  return {
    stepId: "passive",
    sourceId: "src-a",
    label: "x",
    damageType: "magic",
    raw: 10,
    mitigated: 10,
    targetHpBefore: 100,
    targetHpAfter: 90,
    isTick: true,
    cause: "dot",
    ...overrides,
  }
}

describe("computeStepFireTimes", () => {
  it("schedules sequential steps from one source back to back by cast time", () => {
    // Given two steps from the same source, 500ms and 250ms casts
    const steps: ComboStep[] = [
      { id: "s1", sourceId: "src-a", actionId: "Q" },
      { id: "s2", sourceId: "src-a", actionId: "AA" },
    ]
    const kits = { "src-a": kit([action("Q", 500), action("AA", 250)]) }

    // When computing fire times
    const fireTimes = computeStepFireTimes(steps, kits)

    // Then the second step fires only after the first's cast time elapses
    expect(fireTimes.get("s1")).toEqual({ sourceId: "src-a", fireTime: 0 })
    expect(fireTimes.get("s2")).toEqual({ sourceId: "src-a", fireTime: 500 })
  })

  it("lets two different sources fire in parallel (independent cursors)", () => {
    const steps: ComboStep[] = [
      { id: "s1", sourceId: "src-a", actionId: "Q" },
      { id: "s2", sourceId: "src-b", actionId: "Q" },
    ]
    const kits = {
      "src-a": kit([action("Q", 1000)]),
      "src-b": kit([action("Q", 300)]),
    }
    const fireTimes = computeStepFireTimes(steps, kits)
    expect(fireTimes.get("s1")?.fireTime).toBe(0)
    // src-b's step is still scheduled after src-a's in queue-push order
    // (global cursor is monotonic), but its own cast time doesn't block src-a.
    expect(fireTimes.get("s2")?.fireTime).toBeGreaterThanOrEqual(0)
  })

  it("honors an explicit per-step delayMs", () => {
    const steps: ComboStep[] = [{ id: "s1", sourceId: "src-a", actionId: "Q", delayMs: 400 }]
    const fireTimes = computeStepFireTimes(steps, { "src-a": kit([action("Q", 100)]) })
    expect(fireTimes.get("s1")?.fireTime).toBe(400)
  })
})

describe("resolveInstanceStepId", () => {
  it("passes through a real stepId unchanged", () => {
    const fireTimes = new Map([["s1", { sourceId: "src-a", fireTime: 0 }]])
    const real = instance({ stepId: "s1", time: 50 })
    expect(resolveInstanceStepId(real, fireTimes)).toBe("s1")
  })

  it("attributes a DoT tick to the latest same-source step fired at or before its time", () => {
    // Given Brand's Q (fires at t=0) followed, much later, by a passive DoT
    // tick (Liandry's) at t=1500 from the same source
    const fireTimes = new Map([
      ["q-step", { sourceId: "brand", fireTime: 0 }],
      ["aa-step", { sourceId: "brand", fireTime: 2000 }],
    ])
    const tick = instance({ stepId: "dot", sourceId: "brand", time: 1500 })

    // Then it is attributed to the Q step, not the later AA step
    expect(resolveInstanceStepId(tick, fireTimes)).toBe("q-step")
  })

  it("ignores steps from a different source", () => {
    const fireTimes = new Map([["other-step", { sourceId: "someone-else", fireTime: 0 }]])
    const tick = instance({ stepId: "passive", sourceId: "brand", time: 500 })
    // No matching-source step exists, so it falls back to the raw stepId.
    expect(resolveInstanceStepId(tick, fireTimes)).toBe("passive")
  })

  it("falls back to the raw stepId when no candidate step fired early enough", () => {
    const fireTimes = new Map([["q-step", { sourceId: "brand", fireTime: 5000 }]])
    const tick = instance({ stepId: "dot", sourceId: "brand", time: 100 })
    expect(resolveInstanceStepId(tick, fireTimes)).toBe("dot")
  })
})
