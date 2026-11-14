import { render } from "@testing-library/react"
import { Position } from "@xyflow/react"
import { describe, expect, it } from "vitest"
import { FlowEdge } from "./FlowEdge"

const BASE_PROPS = {
  id: "edge-1",
  source: "node-a",
  target: "node-b",
  sourceX: 0,
  sourceY: 0,
  targetX: 100,
  targetY: 100,
  sourcePosition: Position.Right,
  targetPosition: Position.Left,
} as const

function renderEdge(data: { readonly highlighted?: boolean; readonly dimmed?: boolean } = {}) {
  return render(
    // biome-ignore lint/a11y/noSvgWithoutTitle: test-only wrapper around an SVG path fragment, never shown to a user
    <svg>
      <FlowEdge {...BASE_PROPS} data={data} />
    </svg>,
  )
}

describe("FlowEdge", () => {
  it("renders a path with no highlighted/dimmed data attributes by default", () => {
    // Given an edge with no highlight/dim data
    const { container } = renderEdge()

    // When inspecting the rendered path
    const path = container.querySelector("path")

    // Then neither data attribute is present
    expect(path?.getAttribute("data-highlighted")).toBeNull()
    expect(path?.getAttribute("data-dimmed")).toBeNull()
  })

  it("marks data-highlighted when data.highlighted is true", () => {
    // Given a highlighted edge
    const { container } = renderEdge({ highlighted: true })

    // When inspecting the rendered path
    // Then the highlighted data attribute is set
    expect(container.querySelector("path")?.getAttribute("data-highlighted")).toBe("true")
  })

  it("marks data-dimmed when data.dimmed is true", () => {
    // Given a dimmed edge
    const { container } = renderEdge({ dimmed: true })

    // When inspecting the rendered path
    // Then the dimmed data attribute is set
    expect(container.querySelector("path")?.getAttribute("data-dimmed")).toBe("true")
  })
})
