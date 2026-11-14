import { render, screen } from "@testing-library/react"
import { describe, expect, it } from "vitest"
import { DamageTypeChip } from "./DamageTypeChip"

describe("DamageTypeChip", () => {
  it("renders the formatted value as visible text", () => {
    // Given a physical damage chip with a formatted value
    render(<DamageTypeChip type="physical">1,284</DamageTypeChip>)

    // When queried by its visible text
    // Then the value is present
    expect(screen.getByText("1,284")).toBeTruthy()
  })

  it("announces the damage type name for assistive tech", () => {
    // Given a magic damage chip
    render(<DamageTypeChip type="magic">512</DamageTypeChip>)

    // When queried by the screen-reader-only label
    // Then it names the damage type
    expect(screen.getByText("Magic:")).toBeTruthy()
  })

  it.each([["physical"], ["magic"], ["true"]] as const)(
    "renders a %s swatch marked data-type for the shape-cue stylesheet",
    (type) => {
      // Given a chip of each damage type
      const { container } = render(<DamageTypeChip type={type}>1</DamageTypeChip>)

      // When inspecting the swatch element
      // Then it carries the matching data-type attribute the CSS keys off
      expect(container.querySelector(`[data-type="${type}"]`)).toBeTruthy()
    },
  )
})
