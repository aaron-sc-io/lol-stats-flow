import { fireEvent, render, screen } from "@testing-library/react"
import { useState } from "react"
import { describe, expect, it } from "vitest"
import { SearchField } from "./SearchField"

function ControlledSearchField(props: { readonly enableSlashHotkey?: boolean }) {
  const [value, setValue] = useState("")
  return (
    <SearchField
      value={value}
      onChange={setValue}
      aria-label="Search champions"
      enableSlashHotkey={props.enableSlashHotkey}
    />
  )
}

describe("SearchField", () => {
  it("calls onChange as the user types", () => {
    // Given an empty search field
    render(<ControlledSearchField />)
    const input = screen.getByRole("textbox", { name: "Search champions" })

    // When the user types
    fireEvent.change(input, { target: { value: "yas" } })

    // Then the input reflects the new value
    expect(input).toHaveProperty("value", "yas")
  })

  it("shows a clear button only once there is a value, and clears on click", () => {
    // Given a search field with no value
    render(<ControlledSearchField />)
    const input = screen.getByRole("textbox", { name: "Search champions" })
    expect(screen.queryByRole("button", { name: "Clear search" })).toBeNull()

    // When text is entered
    fireEvent.change(input, { target: { value: "yas" } })

    // Then the clear button appears
    const clearButton = screen.getByRole("button", { name: "Clear search" })

    // When it is clicked
    fireEvent.click(clearButton)

    // Then the field empties and the clear button disappears again
    expect(input).toHaveProperty("value", "")
    expect(screen.queryByRole("button", { name: "Clear search" })).toBeNull()
  })

  it("focuses the field when / is pressed and the hotkey is enabled", () => {
    // Given a search field with the slash hotkey enabled, and focus elsewhere
    render(<ControlledSearchField enableSlashHotkey />)
    const input = screen.getByRole("textbox", { name: "Search champions" })
    document.body.focus()
    expect(document.activeElement).not.toBe(input)

    // When "/" is pressed
    fireEvent.keyDown(document, { key: "/" })

    // Then the field gains focus
    expect(document.activeElement).toBe(input)
  })

  it("does not steal focus for / without the hotkey enabled", () => {
    // Given a search field with the hotkey disabled (the default)
    render(<ControlledSearchField />)
    const input = screen.getByRole("textbox", { name: "Search champions" })
    document.body.focus()

    // When "/" is pressed
    fireEvent.keyDown(document, { key: "/" })

    // Then focus does not move
    expect(document.activeElement).not.toBe(input)
  })

  it("disables the input and hides the clear button when disabled", () => {
    // Given a disabled search field with a value
    render(<SearchField value="yasuo" onChange={() => {}} aria-label="Search champions" disabled />)

    // When queried
    // Then the input is disabled and the clear button does not render
    expect(screen.getByRole("textbox", { name: "Search champions" })).toHaveProperty(
      "disabled",
      true,
    )
    expect(screen.queryByRole("button", { name: "Clear search" })).toBeNull()
  })
})
