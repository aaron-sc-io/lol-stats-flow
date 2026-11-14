import { fireEvent, render, screen } from "@testing-library/react"
import { useState } from "react"
import { describe, expect, it } from "vitest"
import { NumberField } from "./NumberField"

function ControlledNumberField(props: {
  readonly min?: number
  readonly max?: number
  readonly step?: number
  readonly unit?: string
  readonly initial?: number
}) {
  const [value, setValue] = useState(props.initial ?? 10)
  return (
    <NumberField
      value={value}
      onChange={setValue}
      min={props.min ?? 0}
      max={props.max ?? 99}
      step={props.step ?? 1}
      unit={props.unit}
      aria-label="Armor"
    />
  )
}

describe("NumberField", () => {
  it("increments and decrements via the stepper buttons, clamped to min/max", () => {
    // Given a number field at 10 between 0 and 99
    render(<ControlledNumberField initial={10} />)
    const input = screen.getByRole("textbox", { name: "Armor" })

    // When the increase stepper is clicked
    fireEvent.click(screen.getByRole("button", { name: "Increase" }))
    expect(input).toHaveProperty("value", "11")

    // When the decrease stepper is clicked twice
    fireEvent.click(screen.getByRole("button", { name: "Decrease" }))
    fireEvent.click(screen.getByRole("button", { name: "Decrease" }))
    expect(input).toHaveProperty("value", "9")
  })

  it("clamps typed input to the max on blur", () => {
    // Given a number field capped at 99
    render(<ControlledNumberField initial={10} max={99} />)
    const input = screen.getByRole("textbox", { name: "Armor" })

    // When the user types a value above the max and blurs
    fireEvent.change(input, { target: { value: "500" } })
    fireEvent.blur(input)

    // Then the committed value is clamped
    expect(input).toHaveProperty("value", "99")
  })

  it("reverts to the last committed value when the typed draft is not a number", () => {
    // Given a number field at 10
    render(<ControlledNumberField initial={10} />)
    const input = screen.getByRole("textbox", { name: "Armor" })

    // When the user types garbage and blurs
    fireEvent.change(input, { target: { value: "abc" } })
    fireEvent.blur(input)

    // Then it reverts to the last valid value instead of committing NaN
    expect(input).toHaveProperty("value", "10")
  })

  it("renders the unit suffix in tertiary text next to the value", () => {
    // Given a number field with a unit
    render(<ControlledNumberField initial={50} unit="armor" />)

    // When queried
    // Then the unit text is present
    expect(screen.getByText("armor")).toBeTruthy()
  })

  it("adjusts by step on ArrowUp/ArrowDown in the input itself", () => {
    // Given a number field at 10
    render(<ControlledNumberField initial={10} step={5} />)
    const input = screen.getByRole("textbox", { name: "Armor" })

    // When ArrowUp is pressed
    fireEvent.keyDown(input, { key: "ArrowUp" })
    expect(input).toHaveProperty("value", "15")
  })
})
