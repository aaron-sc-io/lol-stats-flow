import { describe, expect, it } from "vitest"
import { loadSnapshotFixture } from "@/engine/test-support/load-snapshot"
import { buildComboVariants } from "./combo-variants"
import type { ConnectedItemSetSource } from "./selectors"
import type { ChampionFlowNode, ItemSet } from "./types"

const snapshot = loadSnapshotFixture()

function itemSet(id: string): ItemSet {
  return {
    id,
    name: id.toUpperCase(),
    items: [null, null, null, null, null, null],
    rankOverrides: {},
  }
}

function champion(id: string, itemSets: readonly ItemSet[]): ChampionFlowNode {
  return {
    id,
    type: "champion",
    position: { x: 0, y: 0 },
    data: { championId: "Yasuo", level: 11, itemSets },
  }
}

function source(championNode: ChampionFlowNode, set: ItemSet): ConnectedItemSetSource {
  return { itemSetId: set.id, itemSet: set, championNode }
}

describe("buildComboVariants", () => {
  it("crosses every champion's connected item sets and normalizes steps onto champion nodes", () => {
    const a = champion("champ-a", [itemSet("a1"), itemSet("a2")])
    const b = champion("champ-b", [itemSet("b1")])
    const sources = [source(a, itemSet("a1")), source(b, itemSet("b1")), source(a, itemSet("a2"))]

    const variants = buildComboVariants(snapshot, sources, [
      { id: "s1", sourceId: "a1", actionId: "Q" },
      { id: "s2", sourceId: "champ-b", actionId: "Q" },
      { id: "s3", sourceId: "gone", actionId: "Q" },
    ])

    expect(variants.map((variant) => variant.variantName)).toEqual(["A1 + B1", "A2 + B1"])
    for (const variant of variants) {
      expect(Object.keys(variant.kits).sort()).toEqual(["champ-a", "champ-b"])
      expect(variant.steps.map((step) => step.sourceId)).toEqual(["champ-a", "champ-b"])
    }
  })

  it("yields one empty variant when nothing is connected", () => {
    const variants = buildComboVariants(snapshot, [], [{ id: "s1", sourceId: "x", actionId: "Q" }])
    expect(variants).toEqual([
      { variantId: "", variantName: "", itemSetIds: [], kits: {}, steps: [] },
    ])
  })
})
