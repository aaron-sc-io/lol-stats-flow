import { describe, expect, it } from "vitest"
import type { Snapshot } from "@/data/schema"
import type { ChampionFlowNode, FlowNode, ItemSet } from "@/graph/types"
import { decidePatchPin, reconcileCanvasWithSnapshot } from "./patch-pin"

/** `reconcileCanvasWithSnapshot` only ever reads `id`/`name` off
 * champions/items — a minimal stub (cast past the real `Snapshot`'s many
 * unrelated required fields) keeps these fixtures readable instead of
 * hand-filling every `AbilityData`. */
function fakeSnapshot(
  champions: ReadonlyArray<{ readonly id: string; readonly name: string }>,
  items: ReadonlyArray<{ readonly id: number; readonly name: string }>,
): Snapshot {
  return { meta: {}, champions, items } as unknown as Snapshot
}

function itemSet(overrides: Partial<ItemSet> = {}): ItemSet {
  return {
    id: "itemset-1",
    name: "Set 1",
    items: [3031, 3072, null, null, null, null],
    rankOverrides: {},
    ...overrides,
  }
}

function championNode(overrides: Partial<ChampionFlowNode["data"]> = {}): FlowNode {
  return {
    id: "champion-1",
    type: "champion",
    position: { x: 0, y: 0 },
    data: { championId: "Yasuo", level: 11, itemSets: [itemSet()], ...overrides },
  }
}

describe("decidePatchPin", () => {
  it("reports 'current' when the canvas's patch already matches", () => {
    expect(decidePatchPin("16.22.1", "16.22.1", ["16.22.1"])).toEqual({ kind: "current" })
  })

  it("reports 'pinned-available' when the canvas's patch differs but is still shipped", () => {
    expect(decidePatchPin("16.21.1", "16.22.1", ["16.21.1", "16.22.1"])).toEqual({
      kind: "pinned-available",
      pinnedPatch: "16.21.1",
      currentPatch: "16.22.1",
    })
  })

  it("reports 'migrate' when the canvas's patch is no longer shipped", () => {
    expect(decidePatchPin("16.19.1", "16.22.1", ["16.21.1", "16.22.1"])).toEqual({
      kind: "migrate",
      fromPatch: "16.19.1",
      toPatch: "16.22.1",
    })
  })
})

describe("reconcileCanvasWithSnapshot", () => {
  it("leaves every slot untouched when all items/champions are still available", () => {
    const snapshot = fakeSnapshot(
      [{ id: "Yasuo", name: "Yasuo" }],
      [
        { id: 3031, name: "Infinity Edge" },
        { id: 3072, name: "Bloodthirster" },
      ],
    )

    const { nodes, removedLabels } = reconcileCanvasWithSnapshot([championNode()], snapshot, null)

    expect(removedLabels).toEqual([])
    const champion = nodes[0]
    expect(champion?.type === "champion" && champion.data.itemSets[0]?.items).toEqual([
      3031,
      3072,
      null,
      null,
      null,
      null,
    ])
  })

  it("empties a removed item's slot and reports its name from the lookup snapshot", () => {
    const newSnapshot = fakeSnapshot(
      [{ id: "Yasuo", name: "Yasuo" }],
      [{ id: 3031, name: "Infinity Edge" }],
    )
    const oldSnapshot = fakeSnapshot(
      [{ id: "Yasuo", name: "Yasuo" }],
      [
        { id: 3031, name: "Infinity Edge" },
        { id: 3072, name: "Bloodthirster" },
      ],
    )

    const { nodes, removedLabels } = reconcileCanvasWithSnapshot(
      [championNode()],
      newSnapshot,
      oldSnapshot,
    )

    expect(removedLabels).toEqual(["Bloodthirster"])
    const champion = nodes[0]
    expect(champion?.type === "champion" && champion.data.itemSets[0]?.items).toEqual([
      3031,
      null,
      null,
      null,
      null,
      null,
    ])
  })

  it("falls back to a generic label when no lookup snapshot is available (pruned pin)", () => {
    const newSnapshot = fakeSnapshot([{ id: "Yasuo", name: "Yasuo" }], [])

    const { removedLabels } = reconcileCanvasWithSnapshot([championNode()], newSnapshot, null)

    expect(removedLabels).toEqual(["item 3031", "item 3072"])
  })

  it("never removes the itemSet itself, only its slot contents", () => {
    const newSnapshot = fakeSnapshot([{ id: "Yasuo", name: "Yasuo" }], [])

    const { nodes } = reconcileCanvasWithSnapshot([championNode()], newSnapshot, null)

    const champion = nodes[0]
    expect(champion?.type === "champion" && champion.data.itemSets).toHaveLength(1)
  })

  it("leaves non-champion nodes untouched", () => {
    const comboNode: FlowNode = {
      id: "combo-1",
      type: "combo",
      position: { x: 0, y: 0 },
      data: { name: "Combo", steps: [], collapsedSections: [] },
    }
    const snapshot = fakeSnapshot([], [])

    const { nodes, removedLabels } = reconcileCanvasWithSnapshot([comboNode], snapshot, null)

    expect(nodes).toEqual([comboNode])
    expect(removedLabels).toEqual([])
  })
})
