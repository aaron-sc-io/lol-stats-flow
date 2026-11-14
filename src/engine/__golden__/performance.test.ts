import { describe, expect, it } from "vitest"
import { buildKit } from "../kit"
import { simulate } from "../sim/simulate"
import { loadSnapshotFixture } from "../test-support/load-snapshot"

const snapshot = loadSnapshotFixture()

/** Performance AC: "Must recompute in < 5 ms for a 20-step combo." */
describe("simulate performance", () => {
  it("Given a 20-step combo across two sources with items, when simulated, then it completes in under 5ms (warm)", () => {
    const yasuo = buildKit(snapshot, {
      championId: "Yasuo",
      level: 11,
      items: ["Infinity Edge", "Kraken Slayer"],
    })
    const brand = buildKit(snapshot, {
      championId: "Brand",
      level: 11,
      items: ["Liandry's Torment", "Void Staff"],
    })
    const yasuoActionIds = yasuo.actions.map((a) => a.id)
    const brandActionIds = brand.actions.map((a) => a.id)
    const steps = Array.from({ length: 20 }, (_, i) => {
      const useYasuo = i % 2 === 0
      const ids = useYasuo ? yasuoActionIds : brandActionIds
      const actionId = ids[i % ids.length] ?? ids[0] ?? "AA"
      return { id: `s${i}`, sourceId: useYasuo ? "Yasuo" : "Brand", actionId }
    })
    const target = { id: "t", name: "Dummy", maxHp: 3000, armor: 80, magicResist: 60, bonusHp: 0 }

    // Warm up (JIT) before timing.
    simulate({ steps, kits: { Yasuo: yasuo, Brand: brand }, target })

    const iterations = 20
    const start = performance.now()
    for (let i = 0; i < iterations; i++) {
      simulate({ steps, kits: { Yasuo: yasuo, Brand: brand }, target })
    }
    const elapsed = (performance.now() - start) / iterations
    expect(elapsed).toBeLessThan(5)
  })
})
