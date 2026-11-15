import { fireEvent, render, screen } from "@testing-library/react"
import { describe, expect, it, vi } from "vitest"
import { EditableText } from "./EditableText"

describe("EditableText", () => {
  it("renders a text input alongside a decorative pencil icon and forwards change events", () => {
    // Given an EditableText field with a value and change handler
    const onChange = vi.fn()
    const { container } = render(
      <EditableText value="Combo 1" onChange={onChange} aria-label="Combo name" />,
    )

    // When the user edits the input value
    const input = screen.getByRole("textbox", { name: "Combo name" })
    fireEvent.change(input, { target: { value: "Burst Combo" } })

    // Then the change handler fires and the trailing pencil SVG is present and aria-hidden
    expect(onChange).toHaveBeenCalledOnce()
    const svg = container.querySelector("svg")
    expect(svg).not.toBeNull()
    expect(svg?.getAttribute("aria-hidden")).toBe("true")
  })
})
