import { fireEvent, render, screen } from "@testing-library/react"
import { ReactFlowProvider } from "@xyflow/react"
import { beforeEach, describe, expect, it } from "vitest"
import { useGraphStore } from "@/graph/store"
import { AddNodeMenu } from "./AddNodeMenu"

function renderMenu() {
  return render(
    <ReactFlowProvider>
      <AddNodeMenu />
    </ReactFlowProvider>,
  )
}

describe("AddNodeMenu", () => {
  beforeEach(() => {
    useGraphStore.setState({ nodes: [], edges: [] })
  })

  it("opens grouped sections with a 'Graphs:' heading and stripped graph labels", () => {
    renderMenu()
    fireEvent.click(screen.getByRole("button", { name: "Add node" }))

    const menu = screen.getByRole("menu", { name: "Add node" })
    expect(menu).toBeTruthy()
    expect(screen.getByText("Graphs:")).toBeTruthy()

    const items = screen.getAllByRole("menuitem")
    expect(items.map((el) => el.textContent)).toEqual([
      "Champion",
      "Combo",
      "Combo Damage vs Targets",
      "Effective Damage",
    ])
  })

  it("supports keyboard navigation (ArrowDown, ArrowUp, Home, End) and Escape dismissal", () => {
    renderMenu()
    fireEvent.click(screen.getByRole("button", { name: "Add node" }))

    const menu = screen.getByRole("menu", { name: "Add node" })
    const items = screen.getAllByRole("menuitem")
    expect(document.activeElement).toBe(items[0])

    fireEvent.keyDown(menu, { key: "ArrowDown" })
    expect(document.activeElement).toBe(items[1])

    fireEvent.keyDown(menu, { key: "End" })
    expect(document.activeElement).toBe(items[3])

    fireEvent.keyDown(menu, { key: "ArrowDown" })
    expect(document.activeElement).toBe(items[0])

    fireEvent.keyDown(menu, { key: "ArrowUp" })
    expect(document.activeElement).toBe(items[3])

    fireEvent.keyDown(menu, { key: "Home" })
    expect(document.activeElement).toBe(items[0])

    fireEvent.keyDown(document, { key: "Escape" })
    expect(screen.queryByRole("menu")).toBeNull()
  })

  it("adds the selected graph kind and closes the menu", () => {
    renderMenu()
    fireEvent.click(screen.getByRole("button", { name: "Add node" }))
    fireEvent.click(screen.getByRole("menuitem", { name: "Effective Damage" }))

    expect(screen.queryByRole("menu")).toBeNull()
    const nodes = useGraphStore.getState().nodes
    expect(nodes).toHaveLength(1)
    expect(nodes[0]?.type).toBe("graph")
    if (nodes[0]?.type === "graph") {
      expect(nodes[0].data.graphKind).toBe("resists")
    }
  })
})
