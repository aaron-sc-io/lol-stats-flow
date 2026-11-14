import type { Connection } from "@xyflow/react"
import { describe, expect, it } from "vitest"
import { isValidGraphConnection } from "./connection-rules"
import {
  COMBO_OUT_HANDLE,
  COMBO_SOURCES_HANDLE,
  GRAPH_COMBOS_HANDLE,
  itemSetHandleId,
} from "./handle-ids"
import type { ChampionFlowNode, ComboFlowNode, FlowEdge, FlowNode, GraphFlowNode } from "./types"

function championNode(id: string): ChampionFlowNode {
  return {
    id,
    type: "champion",
    position: { x: 0, y: 0 },
    data: { championId: "Yasuo", level: 11, itemSets: [] },
  }
}

function comboNode(id: string): ComboFlowNode {
  return {
    id,
    type: "combo",
    position: { x: 0, y: 0 },
    data: { name: "Combo", steps: [], collapsedSections: [] },
  }
}

function graphNode(id: string): GraphFlowNode {
  return {
    id,
    type: "graph",
    position: { x: 0, y: 0 },
    data: { targets: [], activeTargetId: "", chartType: "bars", xMode: "step" },
  }
}

describe("isValidGraphConnection", () => {
  const itemSetId = "itemset-1"
  const nodes: FlowNode[] = [championNode("champ-1"), comboNode("combo-1"), graphNode("graph-1")]
  const noEdges: FlowEdge[] = []

  it("accepts champion itemSet handle -> combo sources handle", () => {
    // Given a champion node and a combo node
    const connection: Connection = {
      source: "champ-1",
      sourceHandle: itemSetHandleId(itemSetId),
      target: "combo-1",
      targetHandle: COMBO_SOURCES_HANDLE,
    }

    // When validating the connection
    // Then it is accepted
    expect(isValidGraphConnection(connection, nodes, noEdges)).toBe(true)
  })

  it("accepts combo out handle -> graph combos handle", () => {
    const connection: Connection = {
      source: "combo-1",
      sourceHandle: COMBO_OUT_HANDLE,
      target: "graph-1",
      targetHandle: GRAPH_COMBOS_HANDLE,
    }
    expect(isValidGraphConnection(connection, nodes, noEdges)).toBe(true)
  })

  it("rejects champion -> graph (skipping combo)", () => {
    const connection: Connection = {
      source: "champ-1",
      sourceHandle: itemSetHandleId(itemSetId),
      target: "graph-1",
      targetHandle: GRAPH_COMBOS_HANDLE,
    }
    expect(isValidGraphConnection(connection, nodes, noEdges)).toBe(false)
  })

  it("rejects combo -> champion (reversed direction)", () => {
    const connection: Connection = {
      source: "combo-1",
      sourceHandle: COMBO_OUT_HANDLE,
      target: "champ-1",
      targetHandle: itemSetHandleId(itemSetId),
    }
    expect(isValidGraphConnection(connection, nodes, noEdges)).toBe(false)
  })

  it("rejects a wrong target handle on an otherwise-valid pair", () => {
    const connection: Connection = {
      source: "champ-1",
      sourceHandle: itemSetHandleId(itemSetId),
      target: "combo-1",
      targetHandle: "not-sources",
    }
    expect(isValidGraphConnection(connection, nodes, noEdges)).toBe(false)
  })

  it("rejects a self-loop", () => {
    const connection: Connection = {
      source: "combo-1",
      sourceHandle: COMBO_OUT_HANDLE,
      target: "combo-1",
      targetHandle: COMBO_SOURCES_HANDLE,
    }
    expect(isValidGraphConnection(connection, nodes, noEdges)).toBe(false)
  })

  it("rejects an exact duplicate of an existing edge", () => {
    const connection: Connection = {
      source: "champ-1",
      sourceHandle: itemSetHandleId(itemSetId),
      target: "combo-1",
      targetHandle: COMBO_SOURCES_HANDLE,
    }
    const existing: FlowEdge[] = [
      {
        id: "e1",
        source: connection.source,
        sourceHandle: connection.sourceHandle,
        target: connection.target,
        targetHandle: connection.targetHandle,
        type: "flow",
        data: {},
      },
    ]

    expect(isValidGraphConnection(connection, nodes, existing)).toBe(false)
  })

  it("allows a second, distinct edge between the same combo and a different champion", () => {
    const secondChampion = championNode("champ-2")
    const withSecondChampion = [...nodes, secondChampion]
    const connection: Connection = {
      source: "champ-2",
      sourceHandle: itemSetHandleId("itemset-2"),
      target: "combo-1",
      targetHandle: COMBO_SOURCES_HANDLE,
    }
    const existing: FlowEdge[] = [
      {
        id: "e1",
        source: "champ-1",
        sourceHandle: itemSetHandleId(itemSetId),
        target: "combo-1",
        targetHandle: COMBO_SOURCES_HANDLE,
        type: "flow",
        data: {},
      },
    ]

    expect(isValidGraphConnection(connection, withSecondChampion, existing)).toBe(true)
  })
})
