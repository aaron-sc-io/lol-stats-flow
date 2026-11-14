import { fireEvent, render, screen } from "@testing-library/react"
import { describe, expect, it, vi } from "vitest"
import { IconButton } from "./IconButton"

describe("IconButton", () => {
  it("uses aria-label as its accessible name", () => {
    // Given an icon button with an aria-label
    render(<IconButton icon="close" aria-label="Close" />)

    // When queried by accessible name
    // Then it resolves
    expect(screen.getByRole("button", { name: "Close" })).toBeTruthy()
  })

  it("fires onClick when activated", () => {
    // Given an icon button with a click handler
    const onClick = vi.fn()
    render(<IconButton icon="plus" aria-label="Add item set" onClick={onClick} />)

    // When clicked
    fireEvent.click(screen.getByRole("button", { name: "Add item set" }))

    // Then the handler fires
    expect(onClick).toHaveBeenCalledOnce()
  })

  it("renders at each supported size without losing its accessible name", () => {
    // Given the three supported sizes
    for (const size of [24, 28, 32] as const) {
      const { unmount } = render(<IconButton icon="search" aria-label="Search" size={size} />)

      // When queried
      // Then the button is still reachable by name regardless of size
      expect(screen.getByRole("button", { name: "Search" })).toBeTruthy()
      unmount()
    }
  })

  it("does not fire onClick while disabled", () => {
    // Given a disabled icon button
    const onClick = vi.fn()
    render(<IconButton icon="trash" aria-label="Delete" onClick={onClick} disabled />)

    // When clicked
    fireEvent.click(screen.getByRole("button", { name: "Delete" }))

    // Then the handler never fires
    expect(onClick).not.toHaveBeenCalled()
  })
})
