import { fireEvent, render, screen } from "@testing-library/react"
import { ReactFlow, ReactFlowProvider } from "@xyflow/react"
import { beforeEach, describe, expect, it } from "vitest"
import { SnapshotProvider } from "@/data/snapshot-context"
import { loadSnapshotFixture } from "@/engine/test-support/load-snapshot"
import { useGraphStore } from "@/graph/store"
import type { ChampionFlowNode } from "@/graph/types"
import { ChampionNode } from "./ChampionNode"

const snapshot = loadSnapshotFixture()
const NODE_TYPES = { champion: ChampionNode }

function fixtureNode(): ChampionFlowNode {
  return {
    id: "champ-test",
    type: "champion",
    position: { x: 0, y: 0 },
    // jsdom's `ResizeObserver` stub (test-setup.ts) never actually fires,
    // so @xyflow/react would otherwise keep this node `visibility: hidden`
    // forever (its "not yet measured" state) — seeding `measured` up front
    // sidesteps that and renders the node's real content immediately.
    measured: { width: 560, height: 600 },
    data: {
      championId: "Yasuo",
      level: 11,
      itemSets: [
        {
          id: "is-1",
          name: "Build 1",
          items: [3031, null, null, null, null, null],
          rankOverrides: {},
        },
      ],
    },
  }
}

function TestCanvas() {
  const nodes = useGraphStore((s) => s.nodes)
  const edges = useGraphStore((s) => s.edges)
  return <ReactFlow nodes={nodes} edges={edges} nodeTypes={NODE_TYPES} />
}

function renderChampionNode(node: ChampionFlowNode) {
  useGraphStore.setState({ nodes: [node], edges: [] })
  return render(
    <SnapshotProvider snapshot={snapshot}>
      <ReactFlowProvider>
        <TestCanvas />
      </ReactFlowProvider>
    </SnapshotProvider>,
  )
}

function currentNode(): ChampionFlowNode {
  const node = useGraphStore.getState().nodes[0]
  if (node === undefined || node.type !== "champion") {
    throw new Error("test fixture error: expected a champion node at index 0")
  }
  return node
}

describe("ChampionNode", () => {
  beforeEach(() => {
    useGraphStore.setState({ nodes: [], edges: [], hoveredComboId: null })
  })

  it("renders the champion's name and its item set row", () => {
    renderChampionNode(fixtureNode())
    expect(screen.getAllByText("Yasuo").length).toBeGreaterThan(0)
    expect(screen.getByDisplayValue("Build 1")).toBeTruthy()
  })

  it("renaming the item set name field updates the store", () => {
    renderChampionNode(fixtureNode())
    const nameInput = screen.getByDisplayValue("Build 1")
    fireEvent.change(nameInput, { target: { value: "Full Build" } })
    expect(currentNode().data.itemSets[0]?.name).toBe("Full Build")
  })

  it("moving the level slider via the keyboard updates the store", () => {
    renderChampionNode(fixtureNode())
    const slider = screen.getByRole("slider", { name: "Champion level" })
    fireEvent.keyDown(slider, { key: "ArrowRight" })
    expect(currentNode().data.level).toBe(12)
  })

  it("clicking '+ Add item set' appends a new row", () => {
    renderChampionNode(fixtureNode())
    fireEvent.click(screen.getByRole("button", { name: "+ Add item set" }))
    expect(currentNode().data.itemSets).toHaveLength(2)
    expect(currentNode().data.itemSets[1]?.name).toBe("Build 2")
  })

  it("duplicating an item set inserts a copy right after it", () => {
    renderChampionNode(fixtureNode())
    fireEvent.click(screen.getByRole("button", { name: "Duplicate Build 1" }))
    const sets = currentNode().data.itemSets
    expect(sets).toHaveLength(2)
    expect(sets[1]?.name).toBe("Build 1 (copy)")
    expect(sets[1]?.items).toEqual(sets[0]?.items)
  })

  it("removing an item set deletes the row", () => {
    renderChampionNode(fixtureNode())
    fireEvent.click(screen.getByRole("button", { name: "Remove Build 1" }))
    expect(currentNode().data.itemSets).toHaveLength(0)
  })

  it("clicking a filled item slot removes the equipped item", () => {
    renderChampionNode(fixtureNode())
    fireEvent.click(screen.getByRole("button", { name: "Remove Infinity Edge" }))
    expect(currentNode().data.itemSets[0]?.items[0]).toBeNull()
  })
})
