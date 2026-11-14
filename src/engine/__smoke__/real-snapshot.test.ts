import { describe, expect, it } from "vitest"
import { buildKit } from "../kit"
import { simulate } from "../sim/simulate"
import { loadSnapshotFixture } from "../test-support/load-snapshot"

const snapshot = loadSnapshotFixture()

describe("buildKit + simulate — real snapshot smoke test (all 5 modeled champions)", () => {
  it.each(["Yasuo", "Brand", "Vayne", "Darius", "Garen"])(
    "Given %s's real snapshot data, when a kit is built and an AA is simulated, then it resolves without throwing and deals positive damage",
    (championId) => {
      const kit = buildKit(snapshot, { championId, level: 11, items: [] })
      const result = simulate({
        steps: [{ id: "s1", sourceId: championId, actionId: "AA" }],
        kits: { [championId]: kit },
        target: { id: "t", name: "Dummy", maxHp: 2000, armor: 50, magicResist: 50, bonusHp: 0 },
      })
      expect(result.instances.length).toBeGreaterThan(0)
      expect(
        result.totalsByType.physical + result.totalsByType.magic + result.totalsByType.true,
      ).toBeGreaterThan(0)
    },
  )

  it("Given Yasuo with Infinity Edge + Kraken Slayer, when every modeled action is simulated once, then every action resolves without throwing", () => {
    const kit = buildKit(snapshot, {
      championId: "Yasuo",
      level: 11,
      items: ["Infinity Edge", "Kraken Slayer"],
    })
    const steps = kit.actions.map((a, i) => ({ id: `s${i}`, sourceId: "Yasuo", actionId: a.id }))
    const result = simulate({
      steps,
      kits: { Yasuo: kit },
      target: { id: "t", name: "Dummy", maxHp: 5000, armor: 50, magicResist: 50, bonusHp: 0 },
    })
    expect(result.instances.length).toBeGreaterThanOrEqual(kit.actions.length)
  })
})
