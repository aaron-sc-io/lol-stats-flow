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
    useGraphStore.setState({ nodes: [], edges: [], hoveredComboId: null, hoveredStepId: null })
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
    fireEvent.click(screen.getByRole("button", { name: "Yasuo — Infinity Edge" }))
    fireEvent.click(screen.getByTitle("Steel Tempest (Q)"))

    expect(currentCombo().data.steps).toHaveLength(1)
    expect(currentCombo().data.steps[0]).toMatchObject({ sourceId: "is-1", actionId: "Q" })
  })

  it("clicking a stack group's Add button appends the max-stack variant by default (E4)", () => {
    renderComboNode()
    fireEvent.click(screen.getByRole("button", { name: "Yasuo — Infinity Edge" }))
    fireEvent.click(screen.getByRole("button", { name: "Add" }))

    expect(currentCombo().data.steps).toHaveLength(1)
    expect(currentCombo().data.steps[0]?.actionId).toBe("E-stack4")
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
    expect(currentCombo().data.collapsedSections).toContain("is-1")

    fireEvent.click(trigger)
    expect(currentCombo().data.collapsedSections).not.toContain("is-1")
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
    expect(currentCombo().data.steps[0]).toMatchObject({ sourceId: "is-1", actionId: "Q" })
  })
})
