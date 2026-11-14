import { describe, expect, it } from "vitest"
import type { ItemData } from "@/data/schema"
import { canAddItemToSet, resolveItemSlots } from "./item-rules"

function item(
  overrides: Partial<ItemData> & { readonly id: number; readonly name: string },
): ItemData {
  return {
    iconUrl: "",
    goldBase: 0,
    goldTotal: 0,
    goldSell: 0,
    purchasable: true,
    statCategories: [],
    stats: {},
    from: [],
    into: [],
    maps: {},
    uniqueGroups: ["Items/ItemGroups/Default"],
    maxStack: 1,
    passivesAndActives: [],
    modeled: true,
    ...overrides,
  }
}

describe("canAddItemToSet", () => {
  it("allows adding to a set under the 6-item cap with no group conflicts", () => {
    const infinityEdge = item({ id: 3031, name: "Infinity Edge" })
    expect(canAddItemToSet([], infinityEdge)).toEqual({ canAdd: true })
  })

  it("rejects a 7th item once the set is full", () => {
    const filler = item({ id: 1, name: "Filler" })
    const current = Array.from({ length: 6 }, (_, i) => item({ id: 100 + i, name: `Item ${i}` }))
    expect(canAddItemToSet(current, filler)).toEqual({ canAdd: false, reason: "full" })
  })

  it("ignores the near-universal Default group when checking conflicts", () => {
    // Given two items that both carry only the Default group
    const a = item({ id: 1, name: "A" })
    const b = item({ id: 2, name: "B" })
    // Then they can coexist in the same set
    expect(canAddItemToSet([a], b)).toEqual({ canAdd: true })
  })

  it("rejects two boots-line items sharing the restrictive Boots group", () => {
    const bootsGroups = ["Items/ItemGroups/Default", "Items/ItemGroups/Boots"]
    const berserkers = item({ id: 3006, name: "Berserker's Greaves", uniqueGroups: bootsGroups })
    const mercs = item({ id: 3111, name: "Mercury's Treads", uniqueGroups: bootsGroups })
    expect(canAddItemToSet([berserkers], mercs)).toEqual({
      canAdd: false,
      reason: "unique-conflict",
      conflictsWith: "Berserker's Greaves",
    })
  })

  it("rejects re-adding the same unique (maxStack 1) item twice", () => {
    const ie = item({ id: 3031, name: "Infinity Edge" })
    expect(canAddItemToSet([ie], ie)).toEqual({ canAdd: false, reason: "max-stack" })
  })

  it("allows a stackable item up to its maxStack count", () => {
    const stackable = item({ id: 9999, name: "Stacking Trinket", maxStack: 2 })
    expect(canAddItemToSet([stackable], stackable)).toEqual({ canAdd: true })
    expect(canAddItemToSet([stackable, stackable], stackable)).toEqual({
      canAdd: false,
      reason: "max-stack",
    })
  })
})

describe("resolveItemSlots", () => {
  it("resolves item ids to ItemData, skipping nulls and unknown ids", () => {
    const ie = item({ id: 3031, name: "Infinity Edge" })
    const slots = [3031, null, 99999, null, null, null] as const
    expect(resolveItemSlots(slots, [ie])).toEqual([ie])
  })
})
