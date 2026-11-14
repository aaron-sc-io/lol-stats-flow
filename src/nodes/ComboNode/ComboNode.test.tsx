import { fireEvent, render, screen, waitFor } from "@testing-library/react"
import { ReactFlow, ReactFlowProvider } from "@xyflow/react"
import { beforeEach, describe, expect, it } from "vitest"
import { ToastProvider } from "@/components/Toast"
import { SnapshotProvider } from "@/data/snapshot-context"
import { loadSnapshotFixture } from "@/engine/test-support/load-snapshot"
import { COMBO_SOURCES_HANDLE, itemSetHandleId } from "@/graph/handle-ids"
import { useGraphStore } from "@/graph/store"
import type { ChampionFlowNode, ComboFlowNode, FlowEdge } from "@/graph/types"
import { ComboNode } from "./ComboNode"

const snapshot = loadSnapshotFixture()
const NODE_TYPES = { combo: ComboNode }

function championNode(): ChampionFlowNode {
  return {
    id: "champ-1",
    type: "champion",
    position: { x: 0, y: 0 },
    measured: { width: 560, height: 400 },
    data: {
      championId: "Yasuo",
      level: 11,
      itemSets: [
        {
          id: "is-1",
          name: "Infinity Edge",
          items: [3031, null, null, null, null, null],
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
    measured: { width: 380, height: 600 },
    data: { name: "Combo 1", steps: [], collapsedSections: [] },
  }
}

function connectingEdge(): FlowEdge {
  return {
    id: "e1",
    source: "champ-1",
    sourceHandle: itemSetHandleId("is-1"),
    target: "combo-1",
    targetHandle: COMBO_SOURCES_HANDLE,
    type: "flow",
    data: {},
  }
}

function TestCanvas() {
  const nodes = useGraphStore((s) => s.nodes)
  const edges = useGraphStore((s) => s.edges)
  return <ReactFlow nodes={nodes} edges={edges} nodeTypes={NODE_TYPES} />
}

function renderComboNode() {
  useGraphStore.setState({ nodes: [championNode(), comboNode()], edges: [connectingEdge()] })
  return render(
    <SnapshotProvider snapshot={snapshot}>
      <ToastProvider>
        <ReactFlowProvider>
          <TestCanvas />
        </ReactFlowProvider>
      </ToastProvider>
    </SnapshotProvider>,
  )
}

function currentCombo(): ComboFlowNode {
  const node = useGraphStore.getState().nodes.find((n) => n.id === "combo-1")
  if (node === undefined || node.type !== "combo") {
    throw new Error("test fixture error: expected a combo node with id combo-1")
  }
  return node
}

describe("ComboNode", () => {
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
    })
  })

  it("shows the ability palette section for its connected item set, labelled Champion — ItemSet", () => {
    renderComboNode()
    expect(screen.getByRole("button", { name: "Yasuo — Infinity Edge" })).toBeTruthy()
  })

  it("shows the empty-state message when no item set is connected", () => {
    useGraphStore.setState({ nodes: [comboNode()], edges: [] })
    render(
      <SnapshotProvider snapshot={snapshot}>
        <ToastProvider>
          <ReactFlowProvider>
            <TestCanvas />
          </ReactFlowProvider>
        </ToastProvider>
      </SnapshotProvider>,
    )
    expect(screen.getByText("Connect an item set to start a combo.")).toBeTruthy()
  })

  it("clicking a single-action palette button (Q) appends a combo step", () => {
    renderComboNode()
    const qButton = screen.getByRole("button", { name: "Steel Tempest (Q)" })
    expect(screen.queryByRole("button", { name: "Q" })).toBeNull()
    expect(qButton.getAttribute("title")).toBe("Steel Tempest (Q)")
    expect(qButton.querySelector("img")).not.toBeNull()
    expect(qButton.textContent).toBe("Q")

    fireEvent.click(qButton)

    expect(currentCombo().data.steps).toHaveLength(1)
    expect(currentCombo().data.steps[0]).toMatchObject({ sourceId: "champ-1", actionId: "Q" })
  })

  it("renders Yasuo's E stack variants as 5 separate buttons E0..E4 without a stack stepper/Add control, and shows E rank stepper once", () => {
    renderComboNode()

    expect(screen.queryByRole("button", { name: "Add" })).toBeNull()
    expect(screen.queryByLabelText("E stacks")).toBeNull()
    expect(screen.getAllByRole("button", { name: "Decrease E rank" })).toHaveLength(1)
    expect(screen.getAllByRole("button", { name: "Increase E rank" })).toHaveLength(1)

    const expectedVariants = [
      { label: "Sweeping Blade (E)", keyText: "E0", actionId: "E" },
      { label: "Sweeping Blade (E, 1 stored stacks)", keyText: "E1", actionId: "E-stack1" },
      { label: "Sweeping Blade (E, 2 stored stacks)", keyText: "E2", actionId: "E-stack2" },
      { label: "Sweeping Blade (E, 3 stored stacks)", keyText: "E3", actionId: "E-stack3" },
      { label: "Sweeping Blade (E, 4 stored stacks)", keyText: "E4", actionId: "E-stack4" },
    ] as const

    for (const variant of expectedVariants) {
      const btn = screen.getByRole("button", { name: variant.label })
      expect(btn.getAttribute("title")).toBe(variant.label)
      expect(btn.textContent).toBe(variant.keyText)
      fireEvent.click(btn)
    }

    expect(currentCombo().data.steps.map((s) => s.actionId)).toEqual([
      "E",
      "E-stack1",
      "E-stack2",
      "E-stack3",
      "E-stack4",
    ])
  })

  it("renders Auto Attack actions in the same palette button box with a placeholder SVG icon", () => {
    renderComboNode()
    const qButton = screen.getByRole("button", { name: "Steel Tempest (Q)" })
    const aaButton = screen.getByRole("button", { name: "Auto Attack" })
    const aaCritButton = screen.getByRole("button", { name: "Auto Attack (crit)" })
    expect(screen.queryByRole("button", { name: "AA" })).toBeNull()

    expect(aaButton.className).toBe(qButton.className)
    expect(aaCritButton.className).toBe(qButton.className)
    expect(aaButton.querySelector("svg")).not.toBeNull()
    expect(aaCritButton.querySelector("svg")).not.toBeNull()
    expect(aaButton.textContent).toBe("AA")
    expect(aaCritButton.textContent).toBe("AA✳")
  })

  it("lists AA and AA crit first, and gives Q/Q✳ one shared rank stepper", () => {
    renderComboNode()
    const paletteLabels = screen
      .getAllByRole("button")
      .map((b) => b.getAttribute("title"))
      .filter((title) => title !== null)
    expect(paletteLabels.slice(0, 2)).toEqual(["Auto Attack", "Auto Attack (crit)"])

    expect(screen.getAllByRole("button", { name: "Increase Q rank" })).toHaveLength(1)
    const qButton = screen.getByRole("button", { name: "Steel Tempest (Q)" })
    const qEmpoweredButton = screen.getByRole("button", { name: "Steel Tempest ✳ (tornado)" })
    expect(qButton.parentElement).toBe(qEmpoweredButton.parentElement)
  })

  it("renders combo step tiles left-to-right: handles above, the palette icon, no champion/ability text", () => {
    renderComboNode()
    fireEvent.click(screen.getByRole("button", { name: "Steel Tempest (Q)" }))
    fireEvent.click(screen.getByRole("button", { name: "Auto Attack" }))
    fireEvent.click(screen.getByRole("button", { name: "Sweeping Blade (E, 4 stored stacks)" }))

    const stepRows = screen.getAllByRole("listitem")
    expect(stepRows).toHaveLength(3)
    const firstClassName = stepRows[0]?.className
    for (const row of stepRows) {
      expect(row.className).toBe(firstClassName)
      expect(row.getAttribute("data-step-id")).toBeTruthy()
      expect(row.textContent).not.toContain("YA")
      expect(row.textContent).not.toContain("Steel Tempest")
    }

    const [qRow, , eRow] = stepRows
    const reorder = qRow?.querySelector('[aria-label^="Reorder step 1"]')
    const icon = qRow?.querySelector('[title="Steel Tempest (Q)"]')
    if (!(icon instanceof HTMLElement)) {
      throw new Error("test fixture error: expected the step's ability icon")
    }
    expect(reorder?.compareDocumentPosition(icon)).toBe(Node.DOCUMENT_POSITION_FOLLOWING)
    expect(icon.querySelector("img")).not.toBeNull()
    expect(icon.textContent).toBe("Q")
    expect(eRow?.querySelector('[title="Sweeping Blade (E, 4 stored stacks)"]')?.textContent).toBe(
      "E4",
    )
  })

  it("shows one palette row per champion across all its connected item sets, and rank changes apply to every set", () => {
    const base = championNode()
    const twoSets: ChampionFlowNode = {
      ...base,
      data: {
        ...base.data,
        itemSets: [
          ...base.data.itemSets,
          {
            id: "is-2",
            name: "No items",
            items: [null, null, null, null, null, null],
            rankOverrides: {},
          },
        ],
      },
    }
    const secondEdge: FlowEdge = {
      ...connectingEdge(),
      id: "e2",
      sourceHandle: itemSetHandleId("is-2"),
    }
    useGraphStore.setState({ nodes: [twoSets, comboNode()], edges: [connectingEdge(), secondEdge] })
    render(
      <SnapshotProvider snapshot={snapshot}>
        <ToastProvider>
          <ReactFlowProvider>
            <TestCanvas />
          </ReactFlowProvider>
        </ToastProvider>
      </SnapshotProvider>,
    )

    expect(screen.getByRole("button", { name: "Yasuo — Infinity Edge, No items" })).toBeTruthy()
    expect(screen.getAllByRole("button", { name: "Steel Tempest (Q)" })).toHaveLength(1)

    fireEvent.click(screen.getByRole("button", { name: "Decrease Q rank" }))
    const champion = useGraphStore.getState().nodes.find((n) => n.id === "champ-1")
    const ranks =
      champion?.type === "champion" ? champion.data.itemSets.map((set) => set.rankOverrides.Q) : []
    expect(ranks).toHaveLength(2)
    expect(ranks[0]).toBeDefined()
    expect(ranks[0]).toBe(ranks[1])
  })

  it("renaming the combo updates the store", () => {
    renderComboNode()
    const nameInput = screen.getByDisplayValue("Combo 1")
    fireEvent.change(nameInput, { target: { value: "My Combo" } })
    expect(currentCombo().data.name).toBe("My Combo")
  })

  it("toggling the palette section updates collapsedSections", () => {
    renderComboNode()
    const trigger = screen.getByRole("button", { name: "Yasuo — Infinity Edge" })
    // Sections start open (empty collapsedSections) so every ability is
    // immediately clickable without an extra expand step.
    expect(trigger.getAttribute("aria-expanded")).toBe("true")

    fireEvent.click(trigger)
    expect(currentCombo().data.collapsedSections).toContain("champ-1")

    fireEvent.click(trigger)
    expect(currentCombo().data.collapsedSections).not.toContain("champ-1")
  })

  it("deleting a step removes it, and the Undo toast restores it", async () => {
    renderComboNode()
    fireEvent.click(screen.getByRole("button", { name: "Yasuo — Infinity Edge" }))
    fireEvent.click(screen.getByTitle("Steel Tempest (Q)"))
    expect(currentCombo().data.steps).toHaveLength(1)

    fireEvent.click(screen.getByRole("button", { name: /Remove step 1/ }))
    expect(currentCombo().data.steps).toHaveLength(0)

    const undoButton = await screen.findByRole("button", { name: "Undo" })
    fireEvent.click(undoButton)

    await waitFor(() => expect(currentCombo().data.steps).toHaveLength(1))
    expect(currentCombo().data.steps[0]).toMatchObject({ sourceId: "champ-1", actionId: "Q" })
  })

  it("marks a timeline row with data-highlighted while that row is hovered", () => {
    renderComboNode()
    fireEvent.click(screen.getByRole("button", { name: "Steel Tempest (Q)" }))
    const stepId = currentCombo().data.steps[0]?.id
    if (stepId === undefined) {
      throw new Error("test fixture error: expected one combo step")
    }

    const highlightedRow = document.querySelector(`[data-step-id="${stepId}"]`)
    if (!(highlightedRow instanceof HTMLElement)) {
      throw new Error("test fixture error: expected a rendered timeline row")
    }
    fireEvent.mouseEnter(highlightedRow)
    expect(highlightedRow?.getAttribute("data-highlighted")).toBe("true")
  })
})
