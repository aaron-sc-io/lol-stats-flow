import { render, screen } from "@testing-library/react"
import { describe, expect, it } from "vitest"
import { NodeFrame } from "./NodeFrame"

describe("NodeFrame", () => {
  it("renders the label, title, and body content", () => {
    // Given a node frame with a label, title, and body
    render(
      <NodeFrame label="Champion" title="Yasuo">
        <div>Infinity Edge</div>
      </NodeFrame>,
    )

    // When queried
    // Then all three are visible
    expect(screen.getByText("Champion")).toBeTruthy()
    expect(screen.getByText("Yasuo")).toBeTruthy()
    expect(screen.getByText("Infinity Edge")).toBeTruthy()
  })

  it("renders the actions slot", () => {
    // Given a node frame with actions content
    render(
      <NodeFrame label="Combo" title="Full combo" actions={<button type="button">Delete</button>}>
        content
      </NodeFrame>,
    )

    // When queried
    // Then the action is present
    expect(screen.getByRole("button", { name: "Delete" })).toBeTruthy()
  })

  it.each([
    ["selected", { selected: true }],
    ["highlighted", { highlighted: true }],
    ["dimmed", { dimmed: true }],
  ] as const)("exposes data-%s when the %s prop is true", (attribute, props) => {
    // Given each state prop set individually
    const { container } = render(
      <NodeFrame label="Graph" title="Scenario A" {...props}>
        content
      </NodeFrame>,
    )

    // When inspecting the root element
    // Then the matching data attribute is present
    expect(container.querySelector(`[data-${attribute}="true"]`)).toBeTruthy()
  })

  it("exposes no state data attributes by default", () => {
    // Given a node frame with no state props
    const { container } = render(
      <NodeFrame label="Graph" title="Scenario A">
        content
      </NodeFrame>,
    )

    // When inspecting the root element
    // Then none of the state attributes are present
    const root = container.firstElementChild
    expect(root?.getAttribute("data-selected")).toBeNull()
    expect(root?.getAttribute("data-highlighted")).toBeNull()
    expect(root?.getAttribute("data-dimmed")).toBeNull()
  })
})
