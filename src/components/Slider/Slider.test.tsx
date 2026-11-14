import { fireEvent, render, screen } from "@testing-library/react"
import { useState } from "react"
import { describe, expect, it } from "vitest"
import { Slider } from "./Slider"

function ControlledSlider(props: {
  readonly min?: number
  readonly max?: number
  readonly step?: number
  readonly disabled?: boolean
  readonly initial?: number
}) {
  const [value, setValue] = useState(props.initial ?? 5)
  return (
    <Slider
      value={value}
      onChange={setValue}
      min={props.min ?? 0}
      max={props.max ?? 10}
      step={props.step ?? 1}
      disabled={props.disabled ?? false}
      aria-label="Champion level"
    />
  )
}

describe("Slider", () => {
  it("exposes aria-valuemin/max/now for the current value", () => {
    // Given a slider at value 5 between 0 and 10
    render(<ControlledSlider initial={5} />)

    // When queried by its slider role
    const thumb = screen.getByRole("slider", { name: "Champion level" })

    // Then the ARIA value attributes reflect the current state
    expect(thumb.getAttribute("aria-valuemin")).toBe("0")
    expect(thumb.getAttribute("aria-valuemax")).toBe("10")
    expect(thumb.getAttribute("aria-valuenow")).toBe("5")
  })

  it("increments by step on ArrowRight and decrements on ArrowLeft", () => {
    // Given a slider at 5
    render(<ControlledSlider initial={5} step={1} />)
    const thumb = screen.getByRole("slider", { name: "Champion level" })

    // When ArrowRight is pressed
    fireEvent.keyDown(thumb, { key: "ArrowRight" })
    // Then the value increases by one step
    expect(thumb.getAttribute("aria-valuenow")).toBe("6")

    // When ArrowLeft is pressed twice
    fireEvent.keyDown(thumb, { key: "ArrowLeft" })
    fireEvent.keyDown(thumb, { key: "ArrowLeft" })
    // Then the value decreases by two steps from 6
    expect(thumb.getAttribute("aria-valuenow")).toBe("4")
  })

  it("jumps to min on Home and max on End", () => {
    // Given a slider at 5 between 0 and 10
    render(<ControlledSlider initial={5} />)
    const thumb = screen.getByRole("slider", { name: "Champion level" })

    // When Home is pressed
    fireEvent.keyDown(thumb, { key: "Home" })
    expect(thumb.getAttribute("aria-valuenow")).toBe("0")

    // When End is pressed
    fireEvent.keyDown(thumb, { key: "End" })
    expect(thumb.getAttribute("aria-valuenow")).toBe("10")
  })

  it("moves by a larger increment on PageUp/PageDown", () => {
    // Given a slider at 5 with step 1 (PageUp/Down moves by 10x step)
    render(<ControlledSlider initial={5} step={1} max={100} />)
    const thumb = screen.getByRole("slider", { name: "Champion level" })

    // When PageUp is pressed
    fireEvent.keyDown(thumb, { key: "PageUp" })
    expect(thumb.getAttribute("aria-valuenow")).toBe("15")

    // When PageDown is pressed
    fireEvent.keyDown(thumb, { key: "PageDown" })
    expect(thumb.getAttribute("aria-valuenow")).toBe("5")
  })

  it("clamps at the max and does not exceed it", () => {
    // Given a slider already at its max
    render(<ControlledSlider initial={10} min={0} max={10} />)
    const thumb = screen.getByRole("slider", { name: "Champion level" })

    // When ArrowRight is pressed past the max
    fireEvent.keyDown(thumb, { key: "ArrowRight" })

    // Then the value stays clamped at 10
    expect(thumb.getAttribute("aria-valuenow")).toBe("10")
  })

  it("ignores keyboard input and reports aria-disabled when disabled", () => {
    // Given a disabled slider
    render(<ControlledSlider initial={5} disabled />)
    const thumb = screen.getByRole("slider", { name: "Champion level" })
    expect(thumb.getAttribute("aria-disabled")).toBe("true")
    expect(thumb.getAttribute("tabindex")).toBe("-1")

    // When ArrowRight is pressed
    fireEvent.keyDown(thumb, { key: "ArrowRight" })

    // Then the value does not change
    expect(thumb.getAttribute("aria-valuenow")).toBe("5")
  })
})
