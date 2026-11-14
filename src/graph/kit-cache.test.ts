import { describe, expect, it } from "vitest"
import type { ComboAction, Kit } from "@/engine"
import { loadSnapshotFixture } from "@/engine/test-support/load-snapshot"
import { getOrBuildKit } from "./kit-cache"
import type { ItemSet } from "./types"

const snapshot = loadSnapshotFixture()

function itemSet(overrides: Partial<ItemSet> & { readonly id: string }): ItemSet {
  return {
    name: "Build",
    items: [null, null, null, null, null, null],
    rankOverrides: {},
    ...overrides,
  }
}

function requireAction(kit: Kit | undefined, actionId: string): ComboAction {
  const found = kit?.actions.find((action) => action.id === actionId)
  if (found === undefined) {
    throw new Error(`test fixture error: action "${actionId}" not found on kit`)
  }
  return found
}

describe("getOrBuildKit", () => {
  it("returns undefined for a champion not in the snapshot", () => {
    expect(
      getOrBuildKit(snapshot, "NotAChampion", 11, itemSet({ id: "is-unknown" })),
    ).toBeUndefined()
  })

  it("builds a Kit for a modeled champion with its actions", () => {
    const kit = getOrBuildKit(snapshot, "Yasuo", 11, itemSet({ id: "yasuo-is-1" }))
    expect(requireAction(kit, "Q").slot).toBe("Q")
  })

  it("memoizes: identical inputs return the exact same Kit object", () => {
    const set = itemSet({ id: "yasuo-is-2" })
    const first = getOrBuildKit(snapshot, "Yasuo", 11, set)
    const second = getOrBuildKit(snapshot, "Yasuo", 11, set)
    expect(first).toBe(second)
  })

  it("applies a level-appropriate default Q rank, lower at low level than at level 18", () => {
    const lowLevel = getOrBuildKit(snapshot, "Yasuo", 1, itemSet({ id: "yasuo-is-low" }))
    const highLevel = getOrBuildKit(snapshot, "Yasuo", 18, itemSet({ id: "yasuo-is-high" }))
    expect(requireAction(lowLevel, "Q").rank).toBeLessThan(requireAction(highLevel, "Q").rank)
  })

  it("lets an itemSet's explicit rankOverride win over the level default", () => {
    const set = itemSet({ id: "yasuo-is-override", rankOverrides: { Q: 1 } })
    const kit = getOrBuildKit(snapshot, "Yasuo", 18, set)
    expect(requireAction(kit, "Q").rank).toBe(1)
  })

  it("rebuilds (a different Kit instance, with higher attack damage) when an item is equipped", () => {
    const withoutItems = getOrBuildKit(snapshot, "Yasuo", 11, itemSet({ id: "yasuo-items-off" }))
    const withInfinityEdge = getOrBuildKit(
      snapshot,
      "Yasuo",
      11,
      itemSet({ id: "yasuo-items-on", items: [3031, null, null, null, null, null] }),
    )
    expect(withoutItems).not.toBe(withInfinityEdge)
    expect(withInfinityEdge?.ctx.stats.total.attackDamage).toBeGreaterThan(
      withoutItems?.ctx.stats.total.attackDamage ?? Number.POSITIVE_INFINITY,
    )
  })
})
