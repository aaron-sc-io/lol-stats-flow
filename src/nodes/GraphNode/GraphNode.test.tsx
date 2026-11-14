import { fireEvent, render, screen } from "@testing-library/react"
import { ReactFlow, ReactFlowProvider } from "@xyflow/react"
import { beforeEach, describe, expect, it } from "vitest"
import { SnapshotProvider } from "@/data/snapshot-context"
import { loadSnapshotFixture } from "@/engine/test-support/load-snapshot"
import {
  COMBO_OUT_HANDLE,
  COMBO_SOURCES_HANDLE,
  GRAPH_COMBOS_HANDLE,
  itemSetHandleId,
} from "@/graph/handle-ids"
import { useGraphStore } from "@/graph/store"
import type { ChampionFlowNode, ComboFlowNode, FlowEdge, GraphFlowNode } from "@/graph/types"
import { GraphNode } from "./GraphNode"

const snapshot = loadSnapshotFixture()
const NODE_TYPES = { graph: GraphNode }
const MEASURED = { width: 640, height: 700 }

function championNode(): ChampionFlowNode {
  return {
    id: "champ-1",
    type: "champion",
    position: { x: 0, y: 0 },
    measured: MEASURED,
    data: {
      championId: "Yasuo",
      level: 11,
      itemSets: [
        { id: "is-1", name: "IE", items: [3031, null, null, null, null, null], rankOverrides: {} },
      ],
    },
  }
}

function comboNode(): ComboFlowNode {
  return {
    id: "combo-1",
    type: "combo",
    position: { x: 0, y: 0 },
    measured: MEASURED,
    data: {
      name: "Combo 1",
      steps: [{ id: "s1", sourceId: "is-1", actionId: "Q" }],
      collapsedSections: [],
    },
  }
}

function graphNode(): GraphFlowNode {
  return {
    id: "graph-1",
    type: "graph",
    position: { x: 0, y: 0 },
    measured: MEASURED,
    data: {
      targets: [
        { id: "t1", name: "Target 1", maxHp: 2000, bonusHp: 0, armor: 80, magicResist: 50 },
      ],
      activeTargetId: "t1",
      chartType: "bars",
      xMode: "step",
    },
  }
}

function allEdges(): FlowEdge[] {
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

function TestCanvas() {
  const nodes = useGraphStore((s) => s.nodes)
  const edges = useGraphStore((s) => s.edges)
  return <ReactFlow nodes={nodes} edges={edges} nodeTypes={NODE_TYPES} />
}

function renderGraphNode() {
  useGraphStore.setState({ nodes: [championNode(), comboNode(), graphNode()], edges: allEdges() })
  return render(
    <SnapshotProvider snapshot={snapshot}>
      <ReactFlowProvider>
        <TestCanvas />
      </ReactFlowProvider>
    </SnapshotProvider>,
  )
}

function currentGraph(): GraphFlowNode {
  const node = useGraphStore.getState().nodes.find((n) => n.id === "graph-1")
  if (node === undefined || node.type !== "graph") {
    throw new Error("test fixture error: expected a graph node with id graph-1")
  }
  return node
}

describe("GraphNode", () => {
  beforeEach(() => {
    useGraphStore.setState({ nodes: [], edges: [], hoveredComboId: null, hoveredStepId: null })
  })

  it("renders the comparison table with a row for the connected combo", () => {
    renderGraphNode()
    expect(screen.getAllByText("Combo 1").length).toBeGreaterThan(0)
    expect(screen.getAllByText("Target 1").length).toBeGreaterThan(0)
  })

  it("switching chart type updates the store", () => {
    renderGraphNode()
    fireEvent.click(screen.getByRole("radio", { name: "Cumulative" }))
    expect(currentGraph().data.chartType).toBe("cumulative")
  })

  it("switching x-axis mode updates the store", () => {
    renderGraphNode()
    fireEvent.click(screen.getByRole("radio", { name: "Tick" }))
    expect(currentGraph().data.xMode).toBe("tick")
  })

  it("renaming a target updates the store", () => {
    renderGraphNode()
    const nameInput = screen.getByDisplayValue("Target 1")
    fireEvent.change(nameInput, { target: { value: "Dummy" } })
    expect(currentGraph().data.targets[0]?.name).toBe("Dummy")
  })

  it("applying the Tank preset updates HP/armor/MR and resets bonus HP", () => {
    renderGraphNode()
    fireEvent.click(screen.getByRole("button", { name: "Tank" }))
    expect(currentGraph().data.targets[0]).toMatchObject({
      maxHp: 4200,
      armor: 150,
      magicResist: 100,
    })
  })

  it("clicking '+ Add target' appends a second target", () => {
    renderGraphNode()
    fireEvent.click(screen.getByRole("button", { name: "+ Add target" }))
    expect(currentGraph().data.targets).toHaveLength(2)
  })
})
