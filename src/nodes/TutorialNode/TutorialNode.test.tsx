import { fireEvent, render, screen } from "@testing-library/react"
import { ReactFlow, ReactFlowProvider } from "@xyflow/react"
import { beforeEach, describe, expect, it } from "vitest"
import { createTutorialCanvas, TUTORIAL_NODE_ID } from "@/graph/default-canvas"
import { useGraphStore } from "@/graph/store"
import { CanvasDocumentSchema } from "@/persistence/schema"
import { TutorialNode } from "./TutorialNode"
import { TUTORIAL_STEPS } from "./tutorial-steps"

const NODE_TYPES = { tutorial: TutorialNode }

function TestCanvas() {
  const nodes = useGraphStore((s) => s.nodes)
  return (
    <ReactFlowProvider>
      <div style={{ width: 1200, height: 800 }}>
        <ReactFlow nodes={nodes} edges={[]} nodeTypes={NODE_TYPES} />
      </div>
    </ReactFlowProvider>
  )
}

function storedStep(): number | undefined {
  const node = useGraphStore.getState().nodes.find((n) => n.id === TUTORIAL_NODE_ID)
  return node?.type === "tutorial" ? node.data.step : undefined
}

describe("TutorialNode", () => {
  beforeEach(() => {
    const tutorial = createTutorialCanvas()
      .nodes.filter((node) => node.type === "tutorial")
      .map((node) => ({ ...node, measured: { width: 380, height: 300 } }))
    useGraphStore.getState().loadCanvas(tutorial, [])
  })

  it("walks forward and back through the steps, storing progress", () => {
    render(<TestCanvas />)
    const [first, second] = TUTORIAL_STEPS
    expect(screen.getByText(first?.title ?? "")).toBeTruthy()
    expect(screen.getByRole("button", { name: "Back" }).hasAttribute("disabled")).toBe(true)

    fireEvent.click(screen.getByRole("button", { name: "Next" }))
    expect(storedStep()).toBe(1)
    expect(screen.getByText(second?.title ?? "")).toBeTruthy()

    fireEvent.click(screen.getByRole("button", { name: "Back" }))
    expect(storedStep()).toBe(0)
  })

  it("offers Restart on the last step and jumps via the step dots", () => {
    render(<TestCanvas />)
    const lastIndex = TUTORIAL_STEPS.length - 1
    fireEvent.click(
      screen.getByRole("button", {
        name: `Step ${lastIndex + 1}: ${TUTORIAL_STEPS[lastIndex]?.title}`,
      }),
    )
    expect(storedStep()).toBe(lastIndex)
    fireEvent.click(screen.getByRole("button", { name: "Restart" }))
    expect(storedStep()).toBe(0)
  })
})

describe("createTutorialCanvas", () => {
  it("is the default chain plus one tutorial node, and persists", () => {
    const { nodes, edges } = createTutorialCanvas()
    expect(nodes.map((node) => node.type)).toEqual(["tutorial", "champion", "combo", "graph"])
    const parsed = CanvasDocumentSchema.parse({
      schemaVersion: 1,
      id: "c",
      name: "Tutorial",
      patch: "1.0",
      createdAt: "",
      updatedAt: "",
      graph: {
        nodes: nodes.map(({ id, type, position, data }) => ({ id, type, position, data })),
        edges: edges.map(({ id, source, sourceHandle, target, targetHandle, type }) => ({
          id,
          source,
          sourceHandle: sourceHandle ?? null,
          target,
          targetHandle: targetHandle ?? null,
          type,
        })),
      },
    })
    expect(parsed.graph.nodes[0]).toMatchObject({ type: "tutorial", data: { step: 0 } })
  })
})
