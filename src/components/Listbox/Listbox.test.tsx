import { fireEvent, render, screen } from "@testing-library/react"
import { useState } from "react"
import { describe, expect, it, vi } from "vitest"
import { Listbox } from "./Listbox"

type Role = { readonly id: string; readonly label: string }

const ROLES: readonly Role[] = [
  { id: "top", label: "Top" },
  { id: "jungle", label: "Jungle" },
  { id: "mid", label: "Mid" },
  { id: "bottom", label: "Bottom" },
  { id: "support", label: "Support" },
]

function ControlledListbox(props: { readonly onChangeSpy?: (role: Role) => void }) {
  const [value, setValue] = useState<Role | null>(null)
  return (
    <Listbox
      items={ROLES}
      value={value}
      onChange={(role) => {
        setValue(role)
        props.onChangeSpy?.(role)
      }}
      getKey={(role) => role.id}
      getLabel={(role) => role.label}
      aria-label="Role"
      placeholder="Select a role"
    />
  )
}

describe("Listbox", () => {
  it("shows the placeholder until a value is chosen", () => {
    // Given an unselected listbox
    render(<ControlledListbox />)

    // When queried by its trigger
    // Then the placeholder is visible and the popup is closed
    const trigger = screen.getByRole("button", { name: "Select a role" })
    expect(trigger.getAttribute("aria-expanded")).toBe("false")
  })

  it("opens the popover and moves aria-activedescendant on ArrowDown without committing", () => {
    // Given an open listbox with no value selected (active defaults to index 0)
    render(<ControlledListbox />)
    fireEvent.click(screen.getByRole("button", { name: "Select a role" }))
    const listbox = screen.getByRole("listbox", { name: "Role" })

    // When ArrowDown is pressed
    fireEvent.keyDown(listbox, { key: "ArrowDown" })

    // Then the active descendant moves to the second option ("Jungle")...
    const activeId = listbox.getAttribute("aria-activedescendant")
    expect(screen.getByText("Jungle").id).toBe(activeId)
    // ...but the trigger has not committed anything yet
    expect(screen.getByRole("button", { name: "Select a role" })).toBeTruthy()
  })

  it("commits the active option on Enter and closes the popover", () => {
    // Given an open listbox with the second option active
    const onChangeSpy = vi.fn()
    render(<ControlledListbox onChangeSpy={onChangeSpy} />)
    fireEvent.click(screen.getByRole("button", { name: "Select a role" }))
    const listbox = screen.getByRole("listbox", { name: "Role" })
    fireEvent.keyDown(listbox, { key: "ArrowDown" })

    // When Enter is pressed
    fireEvent.keyDown(listbox, { key: "Enter" })

    // Then the value commits and the trigger now shows it, popover closed
    expect(onChangeSpy).toHaveBeenCalledWith(ROLES[1])
    expect(screen.getByRole("button", { name: "Jungle" })).toBeTruthy()
    expect(screen.queryByRole("listbox")).toBeNull()
  })

  it("closes without committing on Escape", () => {
    // Given an open listbox with a different option highlighted
    const onChangeSpy = vi.fn()
    render(<ControlledListbox onChangeSpy={onChangeSpy} />)
    fireEvent.click(screen.getByRole("button", { name: "Select a role" }))
    const listbox = screen.getByRole("listbox", { name: "Role" })
    fireEvent.keyDown(listbox, { key: "ArrowDown" })

    // When Escape is pressed
    fireEvent.keyDown(listbox, { key: "Escape" })

    // Then nothing committed and the popover is closed
    expect(onChangeSpy).not.toHaveBeenCalled()
    expect(screen.queryByRole("listbox")).toBeNull()
    expect(screen.getByRole("button", { name: "Select a role" })).toBeTruthy()
  })

  it("jumps the active option via typeahead", () => {
    // Given an open listbox
    render(<ControlledListbox />)
    fireEvent.click(screen.getByRole("button", { name: "Select a role" }))
    const listbox = screen.getByRole("listbox", { name: "Role" })

    // When the user types "s" (matching "Support")
    fireEvent.keyDown(listbox, { key: "s" })

    // Then the active descendant jumps to "Support"
    const activeId = listbox.getAttribute("aria-activedescendant")
    expect(screen.getByText("Support").id).toBe(activeId)
  })

  it("commits immediately on option click", () => {
    // Given an open listbox
    const onChangeSpy = vi.fn()
    render(<ControlledListbox onChangeSpy={onChangeSpy} />)
    fireEvent.click(screen.getByRole("button", { name: "Select a role" }))

    // When an option is clicked directly
    fireEvent.click(screen.getByRole("option", { name: "Mid" }))

    // Then it commits and closes
    expect(onChangeSpy).toHaveBeenCalledWith(ROLES[2])
    expect(screen.queryByRole("listbox")).toBeNull()
  })
})
