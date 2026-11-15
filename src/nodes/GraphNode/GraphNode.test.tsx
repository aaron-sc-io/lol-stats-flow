import { act, fireEvent, render, screen, within } from "@testing-library/react"
import { ReactFlow, ReactFlowProvider } from "@xyflow/react"
import { beforeEach, describe, expect, it, vi } from "vitest"
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
import { POPOVER_LEAVE_GRACE_MS, POPOVER_OPEN_DELAY_MS, POPOVER_TRANSITION_MS } from "./ChartLegend"
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
      activeTargetIds: ["t1"],
      chartType: "cumulative",
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
    useGraphStore.setState({
      nodes: [],
      edges: [],
      hoveredComboId: null,
      hoveredGraphSeriesId: null,
      hoveredStepId: null,
      hoveredStepIds: [],
      hoveredItemSetId: null,
      hoveredItemSetIds: [],
      hoveredDamage: null,
      pinnedGraphSeriesId: null,
    })
  })

  it("renders the comparison table with a row for the connected combo", () => {
    renderGraphNode()
    expect(screen.getAllByText("Combo 1").length).toBeGreaterThan(0)
    expect(screen.getAllByText("Target 1").length).toBeGreaterThan(0)
  })

  it("switching chart type updates the store", () => {
    renderGraphNode()
    fireEvent.click(screen.getByRole("radio", { name: "Target HP" }))
    expect(currentGraph().data.chartType).toBe("hp")
  })

  it("offers only the cumulative and target-HP chart types", () => {
    renderGraphNode()
    const chartType = screen.getByRole("radiogroup", { name: "Chart type" })
    expect(
      within(chartType)
        .getAllByRole("radio")
        .map((radio) => radio.textContent),
    ).toEqual(["Cumulative", "Target HP"])
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

  it("clicking 'Add target' appends a second target", () => {
    renderGraphNode()
    fireEvent.click(screen.getByRole("button", { name: "Add target" }))
    expect(currentGraph().data.targets).toHaveLength(2)
  })

  it("hovering a legend entry marks the matching graph series in transient store state and opens the customization popover after a dwell delay", () => {
    vi.useFakeTimers()
    try {
      renderGraphNode()

      const legendItem = screen.getByRole("button", { name: /Combo 1.*vs Target 1/i })
      fireEvent.mouseEnter(legendItem)

      expect(useGraphStore.getState().hoveredGraphSeriesId).toBe("combo-1__is-1__t1")
      expect(screen.queryByRole("dialog", { name: /Customize Combo 1/i })).toBeNull()
      act(() => {
        vi.advanceTimersByTime(POPOVER_OPEN_DELAY_MS)
      })
      expect(screen.getByRole("dialog", { name: /Customize Combo 1/i })).toBeTruthy()

      fireEvent.click(screen.getByRole("button", { name: "Dash style Dotted" }))
      expect(currentGraph().data.seriesOverrides?.["combo-1__is-1__t1"]?.dashStyle).toBe("dotted")

      fireEvent.mouseLeave(legendItem)
      expect(useGraphStore.getState().hoveredGraphSeriesId).toBeNull()
    } finally {
      vi.useRealTimers()
    }
  })

  it("does not open the popover when the cursor sweeps past before the dwell delay", () => {
    vi.useFakeTimers()
    try {
      renderGraphNode()
      const legendItem = screen.getByRole("button", { name: /Combo 1.*vs Target 1/i })
      fireEvent.mouseEnter(legendItem)
      act(() => {
        vi.advanceTimersByTime(POPOVER_OPEN_DELAY_MS - 50)
      })
      fireEvent.mouseLeave(legendItem)
      act(() => {
        vi.advanceTimersByTime(POPOVER_OPEN_DELAY_MS)
      })
      expect(screen.queryByRole("dialog", { name: /Customize Combo 1/i })).toBeNull()
    } finally {
      vi.useRealTimers()
    }
  })

  it("closes the legend customization popover after the leave grace delay unless re-entered", () => {
    vi.useFakeTimers()
    try {
      renderGraphNode()
      const legendItem = screen.getByRole("button", { name: /Combo 1.*vs Target 1/i })

      fireEvent.mouseEnter(legendItem)
      act(() => {
        vi.advanceTimersByTime(POPOVER_OPEN_DELAY_MS)
      })
      const dialog = screen.getByRole("dialog", { name: /Customize Combo 1/i })
      expect(dialog.getAttribute("data-open")).toBe("true")

      // Leaving trigger starts grace delay; re-entering popover cancels it.
      fireEvent.mouseLeave(legendItem)
      act(() => {
        vi.advanceTimersByTime(POPOVER_LEAVE_GRACE_MS - 20)
      })
      fireEvent.mouseEnter(dialog)
      act(() => {
        vi.advanceTimersByTime(POPOVER_LEAVE_GRACE_MS + POPOVER_TRANSITION_MS)
      })
      expect(
        screen.getByRole("dialog", { name: /Customize Combo 1/i }).getAttribute("data-open"),
      ).toBe("true")

      // Leaving popover closes after grace delay and unmounts after transition.
      fireEvent.mouseLeave(dialog)
      act(() => {
        vi.advanceTimersByTime(POPOVER_LEAVE_GRACE_MS)
      })
      expect(dialog.getAttribute("data-open")).toBe("false")
      act(() => {
        vi.advanceTimersByTime(POPOVER_TRANSITION_MS)
      })
      expect(screen.queryByRole("dialog", { name: /Customize Combo 1/i })).toBeNull()
    } finally {
      vi.useRealTimers()
    }
  })

  it("clicking a legend entry pins and unpins the series in transient store state", () => {
    renderGraphNode()

    const legendItem = screen.getByRole("button", { name: /Combo 1.*vs Target 1/i })
    fireEvent.click(legendItem)
    expect(useGraphStore.getState().pinnedGraphSeriesId).toBe("combo-1__is-1__t1")

    fireEvent.click(legendItem)
    expect(useGraphStore.getState().pinnedGraphSeriesId).toBeNull()
  })

  it("clicking the node delete button when selected removes the graph node from the store", () => {
    useGraphStore.setState({
      nodes: [championNode(), comboNode(), { ...graphNode(), selected: true }],
      edges: allEdges(),
    })
    render(
      <SnapshotProvider snapshot={snapshot}>
        <ReactFlowProvider>
          <TestCanvas />
        </ReactFlowProvider>
      </SnapshotProvider>,
    )
    fireEvent.click(screen.getByRole("button", { name: "Delete graph node" }))
    expect(useGraphStore.getState().nodes.find((n) => n.id === "graph-1")).toBeUndefined()
  })
})
