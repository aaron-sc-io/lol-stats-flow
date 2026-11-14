import { fireEvent, render, screen } from "@testing-library/react"
import { describe, expect, it, vi } from "vitest"
import { SegmentedControl } from "./SegmentedControl"

const CHART_OPTIONS = [
  { value: "bars", label: "Bars" },
  { value: "cumulative", label: "Cumulative" },
  { value: "hp", label: "HP remaining" },
] as const

describe("SegmentedControl", () => {
  it("marks the current value checked and the others not", () => {
    // Given a segmented control with "cumulative" selected
    render(
      <SegmentedControl
        options={CHART_OPTIONS}
        value="cumulative"
        onChange={vi.fn()}
        aria-label="Chart type"
      />,
    )

    // When queried by role
    // Then only the matching segment reports checked
    expect(screen.getByRole("radio", { name: "Bars" }).getAttribute("aria-checked")).toBe("false")
    expect(screen.getByRole("radio", { name: "Cumulative" }).getAttribute("aria-checked")).toBe(
      "true",
    )
    expect(screen.getByRole("radio", { name: "HP remaining" }).getAttribute("aria-checked")).toBe(
      "false",
    )
  })

  it("only the selected segment is in the tab order (roving tabindex)", () => {
    // Given "bars" selected
    render(
      <SegmentedControl
        options={CHART_OPTIONS}
        value="bars"
        onChange={vi.fn()}
        aria-label="Chart type"
      />,
    )

    // Then only it has tabIndex 0
    expect(screen.getByRole("radio", { name: "Bars" }).getAttribute("tabindex")).toBe("0")
    expect(screen.getByRole("radio", { name: "Cumulative" }).getAttribute("tabindex")).toBe("-1")
  })

  it("calls onChange when a segment is clicked", () => {
    // Given a segmented control
    const onChange = vi.fn()
    render(
      <SegmentedControl
        options={CHART_OPTIONS}
        value="bars"
        onChange={onChange}
        aria-label="Chart type"
      />,
    )

    // When a different segment is clicked
    fireEvent.click(screen.getByRole("radio", { name: "HP remaining" }))

    // Then onChange reports its value
    expect(onChange).toHaveBeenCalledWith("hp")
  })

  it("moves selection with ArrowRight and wraps past the last segment", () => {
    // Given the last segment selected
    const onChange = vi.fn()
    render(
      <SegmentedControl
        options={CHART_OPTIONS}
        value="hp"
        onChange={onChange}
        aria-label="Chart type"
      />,
    )

    // When ArrowRight is pressed on the focused (selected) segment
    fireEvent.keyDown(screen.getByRole("radio", { name: "HP remaining" }), { key: "ArrowRight" })

    // Then it wraps around to the first option
    expect(onChange).toHaveBeenCalledWith("bars")
  })

  it("moves selection with ArrowLeft and wraps before the first segment", () => {
    // Given the first segment selected
    const onChange = vi.fn()
    render(
      <SegmentedControl
        options={CHART_OPTIONS}
        value="bars"
        onChange={onChange}
        aria-label="Chart type"
      />,
    )

    // When ArrowLeft is pressed
    fireEvent.keyDown(screen.getByRole("radio", { name: "Bars" }), { key: "ArrowLeft" })

    // Then it wraps around to the last option
    expect(onChange).toHaveBeenCalledWith("hp")
  })
})
