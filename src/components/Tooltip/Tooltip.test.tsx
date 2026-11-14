import { act, fireEvent, render, screen } from "@testing-library/react"
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest"
import { Tooltip } from "./Tooltip"

describe("Tooltip", () => {
  beforeEach(() => {
    vi.useFakeTimers()
  })

  afterEach(() => {
    vi.useRealTimers()
  })

  it("does not show the label before the 400ms open delay elapses", () => {
    // Given a focused trigger
    render(
      <Tooltip label="Zoom in">
        <button type="button">+</button>
      </Tooltip>,
    )
    fireEvent.focus(screen.getByRole("button", { name: "+" }))

    // When less than 400ms has passed
    act(() => {
      vi.advanceTimersByTime(399)
    })

    // Then the tooltip is not yet in the document
    expect(screen.queryByRole("tooltip")).toBeNull()
  })

  it("shows the label after the 400ms open delay on focus", () => {
    // Given a focused trigger
    render(
      <Tooltip label="Zoom in">
        <button type="button">+</button>
      </Tooltip>,
    )
    fireEvent.focus(screen.getByRole("button", { name: "+" }))

    // When the open delay elapses
    act(() => {
      vi.advanceTimersByTime(400)
    })

    // Then the tooltip text is visible
    expect(screen.getByRole("tooltip").textContent).toBe("Zoom in")
  })

  it("hides immediately on blur", () => {
    // Given a tooltip already visible via focus
    render(
      <Tooltip label="Zoom in">
        <button type="button">+</button>
      </Tooltip>,
    )
    const trigger = screen.getByRole("button", { name: "+" })
    fireEvent.focus(trigger)
    act(() => {
      vi.advanceTimersByTime(400)
    })
    expect(screen.queryByRole("tooltip")).not.toBeNull()

    // When the trigger blurs
    fireEvent.blur(trigger)

    // Then the tooltip is gone
    expect(screen.queryByRole("tooltip")).toBeNull()
  })

  it("dismisses on Escape while visible", () => {
    // Given a tooltip already visible via focus
    render(
      <Tooltip label="Zoom in">
        <button type="button">+</button>
      </Tooltip>,
    )
    fireEvent.focus(screen.getByRole("button", { name: "+" }))
    act(() => {
      vi.advanceTimersByTime(400)
    })
    expect(screen.queryByRole("tooltip")).not.toBeNull()

    // When Escape is pressed
    fireEvent.keyDown(document, { key: "Escape" })

    // Then the tooltip is dismissed
    expect(screen.queryByRole("tooltip")).toBeNull()
  })

  it("dismisses on scroll instead of tracking a stale position", () => {
    // Given a tooltip already visible via focus
    render(
      <Tooltip label="Zoom in">
        <button type="button">+</button>
      </Tooltip>,
    )
    fireEvent.focus(screen.getByRole("button", { name: "+" }))
    act(() => {
      vi.advanceTimersByTime(400)
    })
    expect(screen.queryByRole("tooltip")).not.toBeNull()

    // When the page scrolls
    fireEvent.scroll(document)

    // Then the tooltip is dismissed rather than left floating in place
    expect(screen.queryByRole("tooltip")).toBeNull()
  })
})
