import { afterEach, describe, expect, it, vi } from "vitest"
import {
  DEFAULT_CHAMPION_NODE_ID,
  DEFAULT_COMBO_NODE_ID,
  DEFAULT_GRAPH_NODE_ID,
  DEFAULT_ITEM_SET_ID,
  DEFAULT_TARGET_ID,
} from "./default-canvas"
import { COMBO_SOURCES_HANDLE, itemSetHandleId } from "./handle-ids"
import { getConnectedItemSetSources, isStepOrphaned } from "./selectors"
import { createGraphStore } from "./store"
import { isChampionNode, isComboNode, isGraphNode } from "./types"

function freshStore() {
  return createGraphStore()
}

afterEach(() => {
  vi.useRealTimers()
})

describe("graph store — initial state", () => {
  it("loads the default Yasuo -> Combo -> Graph canvas", () => {
    const { nodes, edges } = freshStore().getState()
    expect(nodes).toHaveLength(3)
    expect(edges).toHaveLength(2)
    expect(nodes.find((n) => n.id === DEFAULT_CHAMPION_NODE_ID)).toBeDefined()
  })
})

describe("graph store — connections", () => {
  it("onConnect is a no-op for an invalid connection", () => {
    const store = freshStore()
    const before = store.getState().edges
    store.getState().onConnect({
      source: DEFAULT_GRAPH_NODE_ID,
      sourceHandle: null,
      target: DEFAULT_CHAMPION_NODE_ID,
      targetHandle: null,
    })
    expect(store.getState().edges).toBe(before)
  })

  it("onConnect adds a valid new edge", () => {
    const store = freshStore()
    const newComboId = store.getState().addComboNode()
    store.getState().onConnect({
      source: DEFAULT_CHAMPION_NODE_ID,
      sourceHandle: itemSetHandleId(DEFAULT_ITEM_SET_ID),
      target: newComboId,
      targetHandle: COMBO_SOURCES_HANDLE,
    })
    const edges = store.getState().edges
    expect(edges.some((e) => e.target === newComboId)).toBe(true)
  })
})

describe("graph store — add-node factories", () => {
  it("addChampionNode appends a champion node defaulting to Yasuo", () => {
    const store = freshStore()
    const id = store.getState().addChampionNode()
    const node = store.getState().nodes.find((n) => n.id === id)
    expect(node !== undefined && isChampionNode(node) && node.data.championId).toBe("Yasuo")
  })

  it("addComboNode appends an empty combo node", () => {
    const store = freshStore()
    const id = store.getState().addComboNode()
    const node = store.getState().nodes.find((n) => n.id === id)
    expect(node !== undefined && isComboNode(node) && node.data.steps).toEqual([])
  })

  it("addGraphNode appends a graph node with one default target", () => {
    const store = freshStore()
    const id = store.getState().addGraphNode()
    const node = store.getState().nodes.find((n) => n.id === id)
    expect(node !== undefined && isGraphNode(node) && node.data.targets).toHaveLength(1)
  })
})

describe("graph store — item sets and orphaning", () => {
  it("addItemSet appends a new row; removeItemSet removes it and its edge", () => {
    const store = freshStore()
    store.getState().addItemSet(DEFAULT_CHAMPION_NODE_ID)
    const champ = store.getState().nodes.find((n) => n.id === DEFAULT_CHAMPION_NODE_ID)
    expect(champ !== undefined && isChampionNode(champ) && champ.data.itemSets).toHaveLength(2)

    store.getState().removeItemSet(DEFAULT_CHAMPION_NODE_ID, DEFAULT_ITEM_SET_ID)
    const { nodes, edges } = store.getState()
    const championAfter = nodes.find((n) => n.id === DEFAULT_CHAMPION_NODE_ID)
    expect(
      championAfter !== undefined &&
        isChampionNode(championAfter) &&
        championAfter.data.itemSets.some((set) => set.id === DEFAULT_ITEM_SET_ID),
    ).toBe(false)
    expect(edges.some((e) => e.sourceHandle === itemSetHandleId(DEFAULT_ITEM_SET_ID))).toBe(false)
  })

  it("removing the itemSet's edge orphans the combo's steps that reference it", () => {
    const store = freshStore()
    const before = store.getState()
    const combo = before.nodes.find((n) => n.id === DEFAULT_COMBO_NODE_ID)
    const stepsBefore = combo !== undefined && isComboNode(combo) ? combo.data.steps : []
    expect(stepsBefore.length).toBeGreaterThan(0)
    const sourcesBefore = getConnectedItemSetSources(
      DEFAULT_COMBO_NODE_ID,
      before.nodes,
      before.edges,
    )
    expect(stepsBefore.every((step) => !isStepOrphaned(step, sourcesBefore))).toBe(true)

    // When the champion node itself is removed (onNodesChange "remove")
    store.getState().onNodesChange([{ type: "remove", id: DEFAULT_CHAMPION_NODE_ID }])

    // Then every step in the combo that referenced it is now orphaned —
    // still present, never silently deleted.
    const after = store.getState()
    const comboAfter = after.nodes.find((n) => n.id === DEFAULT_COMBO_NODE_ID)
    const stepsAfter =
      comboAfter !== undefined && isComboNode(comboAfter) ? comboAfter.data.steps : []
    expect(stepsAfter).toEqual(stepsBefore)
    const sourcesAfter = getConnectedItemSetSources(DEFAULT_COMBO_NODE_ID, after.nodes, after.edges)
    expect(stepsAfter.every((step) => isStepOrphaned(step, sourcesAfter))).toBe(true)
  })
})

describe("graph store — combo steps", () => {
  it("addComboStep appends, removeComboStep removes, reorderComboSteps reorders", () => {
    const store = freshStore()
    store.getState().addComboStep(DEFAULT_COMBO_NODE_ID, DEFAULT_ITEM_SET_ID, "R")
    let combo = store.getState().nodes.find((n) => n.id === DEFAULT_COMBO_NODE_ID)
    const stepsWithNew = combo !== undefined && isComboNode(combo) ? combo.data.steps : []
    const newStep = stepsWithNew.at(-1)
    expect(newStep?.actionId).toBe("R")

    store.getState().reorderComboSteps(DEFAULT_COMBO_NODE_ID, stepsWithNew.length - 1, 0)
    combo = store.getState().nodes.find((n) => n.id === DEFAULT_COMBO_NODE_ID)
    const reordered = combo !== undefined && isComboNode(combo) ? combo.data.steps : []
    expect(reordered[0]?.actionId).toBe("R")

    const toRemove = reordered[0]
    if (toRemove !== undefined) {
      store.getState().removeComboStep(DEFAULT_COMBO_NODE_ID, toRemove.id)
    }
    combo = store.getState().nodes.find((n) => n.id === DEFAULT_COMBO_NODE_ID)
    const final = combo !== undefined && isComboNode(combo) ? combo.data.steps : []
    expect(final.some((step) => step.actionId === "R")).toBe(false)
  })

  it("restoreComboStep re-inserts a removed step at its original index (the Undo-toast path)", () => {
    const store = freshStore()
    const before = store.getState().nodes.find((n) => n.id === DEFAULT_COMBO_NODE_ID)
    const stepsBefore = before !== undefined && isComboNode(before) ? before.data.steps : []
    const secondStep = stepsBefore[1]
    if (secondStep === undefined) {
      throw new Error("test fixture error: default combo needs at least 2 steps")
    }

    store.getState().removeComboStep(DEFAULT_COMBO_NODE_ID, secondStep.id)
    store.getState().restoreComboStep(DEFAULT_COMBO_NODE_ID, secondStep, 1)

    const after = store.getState().nodes.find((n) => n.id === DEFAULT_COMBO_NODE_ID)
    const stepsAfter = after !== undefined && isComboNode(after) ? after.data.steps : []
    expect(stepsAfter).toEqual(stepsBefore)
  })
})

describe("graph store — targets", () => {
  it("removeTarget reassigns activeTargetId to a remaining target", () => {
    const store = freshStore()
    const secondId = (() => {
      store.getState().addTarget(DEFAULT_GRAPH_NODE_ID)
      const graph = store.getState().nodes.find((n) => n.id === DEFAULT_GRAPH_NODE_ID)
      const targets = graph !== undefined && isGraphNode(graph) ? graph.data.targets : []
      return targets[1]?.id ?? ""
    })()

    const graphBefore = store.getState().nodes.find((n) => n.id === DEFAULT_GRAPH_NODE_ID)
    const activeBefore =
      graphBefore !== undefined && isGraphNode(graphBefore) ? graphBefore.data.activeTargetId : ""

    store.getState().removeTarget(DEFAULT_GRAPH_NODE_ID, activeBefore)

    const graphAfter = store.getState().nodes.find((n) => n.id === DEFAULT_GRAPH_NODE_ID)
    const activeAfter =
      graphAfter !== undefined && isGraphNode(graphAfter) ? graphAfter.data.activeTargetId : ""
    expect(activeAfter).toBe(secondId)
    expect(activeAfter).not.toBe(activeBefore)
  })

  it("applyTargetPreset sets maxHp/armor/magicResist and resets bonusHp", () => {
    const store = freshStore()
    store.getState().applyTargetPreset(DEFAULT_GRAPH_NODE_ID, DEFAULT_TARGET_ID, {
      maxHp: 4200,
      armor: 150,
      magicResist: 100,
    })
    const graph = store.getState().nodes.find((n) => n.id === DEFAULT_GRAPH_NODE_ID)
    const target =
      graph !== undefined && isGraphNode(graph)
        ? graph.data.targets.find((t) => t.id === DEFAULT_TARGET_ID)
        : undefined
    expect(target).toMatchObject({ maxHp: 4200, armor: 150, magicResist: 100, bonusHp: 0 })
  })
})

describe("graph store — undo/redo (zundo temporal)", () => {
  it("undo reverts a level change and redo reapplies it", () => {
    vi.useFakeTimers()
    const store = freshStore()
    store.getState().setChampionLevel(DEFAULT_CHAMPION_NODE_ID, 1)
    // History checkpoints commit after a short burst-quiet delay (`store.ts`'s
    // `HISTORY_BURST_MS`), so a continuous drag/slider-scrub collapses into
    // one undo step instead of one per tick — advance past it before
    // asserting on `pastStates`.
    vi.advanceTimersByTime(1000)

    const levelOf = () => {
      const champ = store.getState().nodes.find((n) => n.id === DEFAULT_CHAMPION_NODE_ID)
      return champ !== undefined && isChampionNode(champ) ? champ.data.level : undefined
    }
    expect(levelOf()).toBe(1)

    store.temporal.getState().undo()
    expect(levelOf()).toBe(11)

    store.temporal.getState().redo()
    expect(levelOf()).toBe(1)
  })

  it("does not record hoveredComboId changes in history (transient, not user input)", () => {
    const store = freshStore()
    const pastBefore = store.temporal.getState().pastStates.length
    store.getState().setHoveredCombo(DEFAULT_COMBO_NODE_ID)
    expect(store.temporal.getState().pastStates.length).toBe(pastBefore)
  })
})
