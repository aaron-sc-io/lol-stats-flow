import { describe, expect, it } from "vitest"
import { loadSnapshotFixture } from "@/engine/test-support/load-snapshot"
import { deriveGraphNodeData } from "./graph-node-derivation"
import {
  COMBO_OUT_HANDLE,
  COMBO_SOURCES_HANDLE,
  GRAPH_COMBOS_HANDLE,
  itemSetHandleId,
} from "./handle-ids"
import type { ChampionFlowNode, ComboFlowNode, FlowEdge, FlowNode, GraphFlowNode } from "./types"

const snapshot = loadSnapshotFixture()

function champion(): ChampionFlowNode {
  return {
    id: "champ-1",
    type: "champion",
    position: { x: 0, y: 0 },
    data: {
      championId: "Yasuo",
      level: 11,
      itemSets: [
        { id: "is-1", name: "IE", items: [3031, null, null, null, null, null], rankOverrides: {} },
      ],
    },
  }
}

function combo(steps: ComboFlowNode["data"]["steps"]): ComboFlowNode {
  return {
    id: "combo-1",
    type: "combo",
    position: { x: 0, y: 0 },
    data: { name: "Combo 1", steps, collapsedSections: [] },
  }
}

function graph(): GraphFlowNode {
  return {
    id: "graph-1",
    type: "graph",
    position: { x: 0, y: 0 },
    data: {
      targets: [
        { id: "t1", name: "Squishy", maxHp: 1000, bonusHp: 0, armor: 0, magicResist: 0 },
        { id: "t2", name: "Tank", maxHp: 4000, bonusHp: 0, armor: 150, magicResist: 100 },
      ],
      activeTargetId: "t1",
      chartType: "bars",
      xMode: "step",
    },
  }
}

function edges(): FlowEdge[] {
  return [
    {
      id: "e1",
      source: "champ-1",
      sourceHandle: itemSetHandleId("is-1"),
      target: "combo-1",
      targetHandle: COMBO_SOURCES_HANDLE,
      type: "flow",
      data: {},
    },
    {
      id: "e2",
      source: "combo-1",
      sourceHandle: COMBO_OUT_HANDLE,
      target: "graph-1",
      targetHandle: GRAPH_COMBOS_HANDLE,
      type: "flow",
      data: {},
    },
  ]
}

describe("deriveGraphNodeData", () => {
  it("produces one chart series (against the active target) per connected combo", () => {
    const nodes: FlowNode[] = [
      champion(),
      combo([{ id: "s1", sourceId: "is-1", actionId: "Q" }]),
      graph(),
    ]
    const { series } = deriveGraphNodeData("graph-1", graph().data, nodes, edges(), snapshot)

    expect(series).toHaveLength(1)
    expect(series[0]?.comboId).toBe("combo-1")
    expect(series[0]?.points).toHaveLength(1)
    expect(series[0]?.points[0]?.physical).toBeGreaterThan(0)
  })

  it("produces a comparison row for every combo x target pair, not just the active target", () => {
    const nodes: FlowNode[] = [
      champion(),
      combo([{ id: "s1", sourceId: "is-1", actionId: "Q" }]),
      graph(),
    ]
    const { rows } = deriveGraphNodeData("graph-1", graph().data, nodes, edges(), snapshot)

    expect(rows).toHaveLength(2)
    expect(rows.map((row) => row.targetId).sort()).toEqual(["t1", "t2"])
    // The same raw hit mitigates less against the tankier target.
    const squishyRow = rows.find((row) => row.targetId === "t1")
    const tankRow = rows.find((row) => row.targetId === "t2")
    expect(squishyRow?.total ?? 0).toBeGreaterThan(tankRow?.total ?? 0)
  })

  it("excludes an orphaned step's champion from the sim once its edge is removed", () => {
    const nodes: FlowNode[] = [
      champion(),
      combo([{ id: "s1", sourceId: "is-1", actionId: "Q" }]),
      graph(),
    ]
    const { rows } = deriveGraphNodeData(
      "graph-1",
      graph().data,
      nodes,
      [edges()[1] as FlowEdge],
      snapshot,
    )

    // No itemSet->combo edge means the step is orphaned and excluded —
    // total damage is 0, not an error.
    expect(rows.every((row) => row.total === 0)).toBe(true)
  })

  it("returns no series/rows for a graph with no connected combos", () => {
    const nodes: FlowNode[] = [graph()]
    const { series, rows } = deriveGraphNodeData("graph-1", graph().data, nodes, [], snapshot)
    expect(series).toEqual([])
    expect(rows).toEqual([])
  })
})
