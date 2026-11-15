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
const MEASURED = { width: 800, height: 700 }

function twoSetChampionNode(): ChampionFlowNode {
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
        {
          id: "is-2",
          name: "No items",
          items: [null, null, null, null, null, null],
          rankOverrides: {},
        },
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
      steps: [{ id: "s1", sourceId: "champ-1", actionId: "Q" }],
      collapsedSections: [],
    },
  }
}

function effectiveGraphNode(effective?: GraphFlowNode["data"]["effective"]): GraphFlowNode {
  return {
    id: "graph-1",
    type: "graph",
    position: { x: 0, y: 0 },
    measured: MEASURED,
    data: {
      graphKind: "resists",
      effective,
      targets: [
        {
          id: "t1",
          name: "Bruiser",
          maxHp: 2000,
          bonusHp: 0,
          armor: 100,
          bonusArmor: 50,
          magicResist: 60,
          bonusMagicResist: 20,
        },
      ],
      activeTargetIds: ["t1"],
      chartType: "cumulative",
      xMode: "step",
    },
  }
}

function edges(includeSecondSet = true): FlowEdge[] {
  const base: FlowEdge[] = [
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
  if (!includeSecondSet) {
    return base
  }
  return [
    ...base,
    {
      id: "e3",
      source: "champ-1",
      sourceHandle: itemSetHandleId("is-2"),
      target: "combo-1",
      targetHandle: COMBO_SOURCES_HANDLE,
      type: "flow",
      data: {},
    },
  ]
}

function TestCanvas() {
  const nodes = useGraphStore((s) => s.nodes)
  const flowEdges = useGraphStore((s) => s.edges)
  return <ReactFlow nodes={nodes} edges={flowEdges} nodeTypes={NODE_TYPES} />
}

function renderEffectiveGraph(
  effective?: GraphFlowNode["data"]["effective"],
  includeSecondSet = true,
) {
  useGraphStore.setState({
    nodes: [twoSetChampionNode(), comboNode(), effectiveGraphNode(effective)],
    edges: edges(includeSecondSet),
  })
  useGraphStore.temporal.getState().clear()
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
    throw new Error("expected graph-1")
  }
  return node
}

describe("Graph: Effective Damage", () => {
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

  it("renders curves view with live resist cursor at 100 and updates readout without recording undo history", () => {
    // Given an effective-damage graph node with two connected item sets
    renderEffectiveGraph()

    // Then the cursor defaults to 100 Armor and the readout table lists both variants
    const slider = screen.getByRole("slider", { name: "Cursor Armor" }) as HTMLInputElement
    expect(slider.value).toBe("100")
    expect(screen.getAllByText(/Combo 1 · IE · Bruiser/).length).toBeGreaterThan(0)
    expect(screen.getAllByText(/Combo 1 · No items · Bruiser/).length).toBeGreaterThan(0)

    // When dragging the cursor to 0 Armor
    fireEvent.change(slider, { target: { value: "0" } })

    // Then the cursor value updates and undo history stays empty
    expect(slider.value).toBe("0")
    expect(useGraphStore.temporal.getState().pastStates).toHaveLength(0)
  })

  it("switches resistance axis between Armor and MR via setEffectiveSettings", () => {
    // Given an effective-damage graph node in curves view
    renderEffectiveGraph()

    // When clicking MR in the Resistance axis segmented control
    fireEvent.click(screen.getByRole("radio", { name: "MR" }))

    // Then the store records resistAxis = magicResist and the cursor label reflects Magic Resist
    expect(currentGraph().data.effective?.resistAxis).toBe("magicResist")
    expect(screen.getByRole("slider", { name: "Cursor Magic Resist" })).toBeTruthy()
  })

  it("shows empty-state hint in Kill map view when fewer than two variants are connected", () => {
    // Given only one item set is connected to the combo
    renderEffectiveGraph({ view: "killMap" }, false)

    // Then the empty state hint is shown
    expect(
      screen.getByText("Connect two item sets (or combos) to compare kill regions."),
    ).toBeTruthy()
  })

  it("renders KillMapChart, legend, bonus share caption, cell hover tooltip, and A/B variant selects", () => {
    // Given two item sets connected in killMap view
    const { container } = renderEffectiveGraph({ view: "killMap" })

    // Then the legend, bonus share caption, and A/B selects render
    expect(screen.getByText("Only Combo 1 · IE kills")).toBeTruthy()
    expect(screen.getByText("Only Combo 1 · No items kills")).toBeTruthy()
    expect(screen.getByText(/Bonus armor share: 50% \(from target Bruiser\)/)).toBeTruthy()

    // When hovering a heatmap cell
    const cell = container.querySelector('rect[data-resist="100"][data-hp="2000"]')
    expect(cell).not.toBeNull()
    if (cell !== null) {
      fireEvent.mouseEnter(cell)
    }

    // Then the tooltip shows HP, Armor, both damages, and Δ (B−A)
    const tooltip = screen.getByRole("tooltip")
    expect(tooltip.textContent).toContain("HP 2,000 · Armor 100")
    expect(tooltip.textContent).toContain("Δ (B−A)")

    // When changing select A to the second variant
    const selectA = screen.getByRole("combobox", { name: "A" })
    fireEvent.change(selectA, { target: { value: "combo-1__is-2" } })

    // Then the store updates killMapA
    expect(currentGraph().data.effective?.killMapA).toBe("combo-1__is-2")
  })
})
