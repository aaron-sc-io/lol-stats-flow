import { describe, expect, it } from "vitest"
import {
  COMBO_OUT_HANDLE,
  COMBO_SOURCES_HANDLE,
  GRAPH_COMBOS_HANDLE,
  itemSetHandleId,
} from "./handle-ids"
import {
  computeHighlightState,
  getConnectedComboIds,
  getConnectedGraphTarget,
  getConnectedItemSetSources,
  isStepOrphaned,
  resolveStepChampionNodeId,
} from "./selectors"
import { fixtureAction, fixtureKit } from "./test-support/fixtures"
import type {
  ChampionFlowNode,
  ComboFlowNode,
  FlowEdge,
  FlowNode,
  GraphFlowNode,
  ItemSet,
} from "./types"

function itemSet(id: string, name: string): ItemSet {
  return { id, name, items: [null, null, null, null, null, null], rankOverrides: {} }
}

function championNode(id: string, itemSets: readonly ItemSet[]): ChampionFlowNode {
  return {
    id,
    type: "champion",
    position: { x: 0, y: 0 },
    data: { championId: "Yasuo", level: 11, itemSets },
  }
}

function comboNode(id: string): ComboFlowNode {
  return {
    id,
    type: "combo",
    position: { x: 0, y: 0 },
    data: { name: id, steps: [], collapsedSections: [] },
  }
}

function graphNode(id: string): GraphFlowNode {
  return {
    id,
    type: "graph",
    position: { x: 0, y: 0 },
    data: { targets: [], activeTargetIds: [], chartType: "cumulative", xMode: "step" },
  }
}

function edge(
  id: string,
  source: string,
  sourceHandle: string,
  target: string,
  targetHandle: string,
): FlowEdge {
  return { id, source, sourceHandle, target, targetHandle, type: "flow", data: {} }
}

describe("getConnectedItemSetSources", () => {
  it("resolves an edge to its owning champion node and itemSet", () => {
    // Given a champion with one itemSet wired to a combo
    const yasuoIE = itemSet("is-1", "Infinity Edge")
    const champ = championNode("champ-1", [yasuoIE])
    const combo = comboNode("combo-1")
    const edges = [edge("e1", "champ-1", itemSetHandleId("is-1"), "combo-1", COMBO_SOURCES_HANDLE)]

    // When resolving the combo's connected sources
    const sources = getConnectedItemSetSources("combo-1", [champ, combo], edges)

    // Then it finds the champion + itemSet
    expect(sources).toEqual([{ itemSetId: "is-1", itemSet: yasuoIE, championNode: champ }])
  })

  it("returns an empty array once the edge is removed", () => {
    const champ = championNode("champ-1", [itemSet("is-1", "Infinity Edge")])
    const combo = comboNode("combo-1")
    expect(getConnectedItemSetSources("combo-1", [champ, combo], [])).toEqual([])
  })
})

describe("isStepOrphaned", () => {
  it("is false while the step's source itemSet is connected", () => {
    const sources = [
      { itemSetId: "is-1", itemSet: itemSet("is-1", "x"), championNode: championNode("c", []) },
    ]
    expect(isStepOrphaned({ id: "s1", sourceId: "is-1", actionId: "Q" }, sources)).toBe(false)
  })

  it("is true once the connecting edge (and thus the source) is gone", () => {
    expect(isStepOrphaned({ id: "s1", sourceId: "is-1", actionId: "Q" }, [])).toBe(true)
  })

  it("given no kits argument, is false for any actionId while connected (back-compat)", () => {
    const sources = [
      { itemSetId: "is-1", itemSet: itemSet("is-1", "x"), championNode: championNode("c", []) },
    ]
    expect(isStepOrphaned({ id: "s1", sourceId: "is-1", actionId: "nonexistent" }, sources)).toBe(
      false,
    )
  })

  it("given kits, is true when the step's action no longer exists in its source's kit (e.g. after switching the champion backing that item set) — prevents simulating a stale step", () => {
    const sources = [
      { itemSetId: "is-1", itemSet: itemSet("is-1", "x"), championNode: championNode("c", []) },
    ]
    const kits = { c: fixtureKit({ actions: [fixtureAction({ id: "Q" })] }) }
    expect(isStepOrphaned({ id: "s1", sourceId: "is-1", actionId: "Q" }, sources, kits)).toBe(false)
    expect(
      isStepOrphaned({ id: "s1", sourceId: "is-1", actionId: "Q-empowered" }, sources, kits),
    ).toBe(true)
  })

  it("given kits, is still true when disconnected even if the actionId happens to be valid elsewhere", () => {
    const kits = { c: fixtureKit({ actions: [fixtureAction({ id: "Q" })] }) }
    expect(isStepOrphaned({ id: "s1", sourceId: "is-1", actionId: "Q" }, [], kits)).toBe(true)
  })

  it("resolves a champion-node sourceId, and a legacy item-set sourceId via any connected sibling item set", () => {
    const champion = championNode("c", [itemSet("is-1", "IE"), itemSet("is-2", "BotRK")])
    const sources = [
      { itemSetId: "is-2", itemSet: itemSet("is-2", "BotRK"), championNode: champion },
    ]
    const kits = { c: fixtureKit({ actions: [fixtureAction({ id: "Q" })] }) }

    expect(resolveStepChampionNodeId({ id: "s1", sourceId: "c", actionId: "Q" }, sources)).toBe("c")
    // "is-1" itself isn't connected, but its champion still is (via is-2).
    expect(isStepOrphaned({ id: "s1", sourceId: "is-1", actionId: "Q" }, sources, kits)).toBe(false)
    expect(isStepOrphaned({ id: "s1", sourceId: "other", actionId: "Q" }, sources, kits)).toBe(true)
  })
})

describe("getConnectedComboIds", () => {
  it("lists every combo wired into a graph's combos handle", () => {
    const edges = [
      edge("e1", "combo-1", COMBO_OUT_HANDLE, "graph-1", GRAPH_COMBOS_HANDLE),
      edge("e2", "combo-2", COMBO_OUT_HANDLE, "graph-1", GRAPH_COMBOS_HANDLE),
    ]
    expect(getConnectedComboIds("graph-1", edges)).toEqual(["combo-1", "combo-2"])
  })
})

describe("getConnectedGraphTarget", () => {
  it("returns undefined for a combo not yet connected to any graph", () => {
    const combo = comboNode("combo-1")
    expect(getConnectedGraphTarget("combo-1", [combo], [])).toBeUndefined()
  })

  it("resolves the active target of the graph a combo feeds into", () => {
    const combo = comboNode("combo-1")
    const graph: GraphFlowNode = {
      ...graphNode("graph-1"),
      data: {
        targets: [
          { id: "t1", name: "Squishy", maxHp: 1800, bonusHp: 0, armor: 30, magicResist: 30 },
          { id: "t2", name: "Tank", maxHp: 4000, bonusHp: 0, armor: 150, magicResist: 100 },
        ],
        activeTargetIds: ["t2"],
        chartType: "cumulative",
        xMode: "step",
      },
    }
    const edges = [edge("e1", "combo-1", COMBO_OUT_HANDLE, "graph-1", GRAPH_COMBOS_HANDLE)]

    const target = getConnectedGraphTarget("combo-1", [combo, graph], edges)

    expect(target?.id).toBe("t2")
    expect(target?.name).toBe("Tank")
  })
})

describe("computeHighlightState", () => {
  // Two champions, two combos, one graph: champ-1 -> combo-1 only;
  // champ-2 -> both combo-1 and combo-2 (shared upstream source).
  const champ1 = championNode("champ-1", [itemSet("is-1", "Set 1")])
  const champ2 = championNode("champ-2", [itemSet("is-2", "Set 2")])
  const combo1 = comboNode("combo-1")
  const combo2 = comboNode("combo-2")
  const graph = graphNode("graph-1")
  const nodes: FlowNode[] = [champ1, champ2, combo1, combo2, graph]
  const edges: FlowEdge[] = [
    edge("e1", "champ-1", itemSetHandleId("is-1"), "combo-1", COMBO_SOURCES_HANDLE),
    edge("e2", "champ-2", itemSetHandleId("is-2"), "combo-1", COMBO_SOURCES_HANDLE),
    edge("e3", "champ-2", itemSetHandleId("is-2"), "combo-2", COMBO_SOURCES_HANDLE),
    edge("e4", "combo-1", COMBO_OUT_HANDLE, "graph-1", GRAPH_COMBOS_HANDLE),
    edge("e5", "combo-2", COMBO_OUT_HANDLE, "graph-1", GRAPH_COMBOS_HANDLE),
  ]

  it("returns an all-empty state when nothing is hovered", () => {
    const state = computeHighlightState(nodes, edges, null)
    expect(state.highlightedNodeIds.size).toBe(0)
    expect(state.dimmedNodeIds.size).toBe(0)
  })

  it("highlights the hovered combo, its sources' champions, and connecting edges (incoming sources + its own outgoing edge)", () => {
    const state = computeHighlightState(nodes, edges, "combo-1")

    expect(state.highlightedNodeIds).toEqual(new Set(["combo-1", "champ-1", "champ-2"]))
    expect(state.highlightedItemSetIds).toEqual(new Set(["is-1", "is-2"]))
    // e1/e2 feed into combo-1; e4 is combo-1's own edge out to the graph.
    expect(state.highlightedEdgeIds).toEqual(new Set(["e1", "e2", "e4"]))
  })

  it("dims the other combo's own edges (its incoming sources + its outgoing edge to the graph)", () => {
    const state = computeHighlightState(nodes, edges, "combo-1")

    // e3 feeds combo-2 (the non-hovered combo); e5 is combo-2's own edge out to the graph.
    expect(state.dimmedEdgeIds).toEqual(new Set(["e3", "e5"]))
  })

  it("dims the other combo but not a champion shared with the hovered combo", () => {
    const state = computeHighlightState(nodes, edges, "combo-1")

    // combo-2 is dimmed (it's not the hovered combo)...
    expect(state.dimmedNodeIds.has("combo-2")).toBe(true)
    // ...but champ-2 also feeds combo-1, so it stays fully highlighted, not dimmed.
    expect(state.dimmedNodeIds.has("champ-2")).toBe(false)
    expect(state.highlightedNodeIds.has("champ-2")).toBe(true)
  })

  it("dims a champion that exclusively feeds the non-hovered combo", () => {
    const soloChamp = championNode("champ-3", [itemSet("is-3", "Set 3")])
    const extraEdges = [
      ...edges,
      edge("e6", "champ-3", itemSetHandleId("is-3"), "combo-2", COMBO_SOURCES_HANDLE),
    ]
    const state = computeHighlightState([...nodes, soloChamp], extraEdges, "combo-1")
    expect(state.dimmedNodeIds.has("champ-3")).toBe(true)
  })

  it("hovering an item set highlights that row, every combo it feeds, and the feeding edges — dims nothing", () => {
    const state = computeHighlightState(nodes, edges, null, ["is-2"])

    expect(state.highlightedItemSetIds).toEqual(new Set(["is-2"]))
    expect(state.highlightedNodeIds).toEqual(new Set(["combo-1", "combo-2"]))
    expect(state.highlightedEdgeIds).toEqual(new Set(["e2", "e3"]))
    expect(state.dimmedNodeIds.size).toBe(0)
    expect(state.dimmedEdgeIds.size).toBe(0)
  })

  it("a hovered combo takes precedence over a hovered item set", () => {
    const state = computeHighlightState(nodes, edges, "combo-2", ["is-1"])

    expect(state.highlightedNodeIds).toEqual(new Set(["combo-2", "champ-2"]))
  })
})
