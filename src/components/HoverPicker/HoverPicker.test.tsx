import { act, fireEvent, render, screen } from "@testing-library/react"
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest"
import * as preloadModule from "@/lib/preloadImages"
import { HoverPicker } from "./HoverPicker"

type Champion = {
  readonly id: string
  readonly name: string
  readonly role: "top" | "adc"
  readonly modeled: boolean
}

const CHAMPIONS: readonly Champion[] = [
  { id: "yasuo", name: "Yasuo", role: "top", modeled: true },
  { id: "vayne", name: "Vayne", role: "adc", modeled: true },
  { id: "garen", name: "Garen", role: "top", modeled: false },
]

function renderPicker(onSelect: (champion: Champion) => void) {
  return render(
    <HoverPicker
      trigger={<span>Portrait</span>}
      items={CHAMPIONS}
      getKey={(champion) => champion.id}
      renderItem={(champion) => champion.name}
      searchText={(champion) => champion.name}
      filters={[
        {
          id: "top",
          icon: "role-top",
          label: "Top",
          predicate: (champion) => champion.role === "top",
        },
        {
          id: "modeled",
          icon: "search",
          label: "Modeled",
          predicate: (champion) => champion.modeled,
        },
      ]}
      isDisabled={(champion) => !champion.modeled}
      disabledBadge="Not modeled"
      onSelect={onSelect}
      aria-label="Choose champion"
    />,
  )
}

describe("HoverPicker", () => {
  beforeEach(() => {
    vi.useFakeTimers()
  })

  afterEach(() => {
    vi.useRealTimers()
  })

  it("opens immediately on click (no hover-intent delay)", () => {
    // Given a closed picker
    renderPicker(vi.fn())

    // When the trigger is clicked
    fireEvent.click(screen.getByRole("button", { name: "Choose champion" }))

    // Then the popover is open with every item visible
    expect(screen.getByRole("dialog", { name: "Choose champion" })).toBeTruthy()
    expect(screen.getByText("Yasuo")).toBeTruthy()
    expect(screen.getByText("Vayne")).toBeTruthy()
    expect(screen.getByText("Garen")).toBeTruthy()
  })

  it("opens after the 150ms hover-intent delay, not before", () => {
    // Given a closed picker
    renderPicker(vi.fn())
    const trigger = screen.getByRole("button", { name: "Choose champion" })

    // When the pointer enters the trigger
    fireEvent.pointerEnter(trigger)

    // Then it is not yet open just before the delay elapses
    act(() => {
      vi.advanceTimersByTime(149)
    })
    expect(screen.queryByRole("dialog")).toBeNull()

    // And it opens once the delay elapses
    act(() => {
      vi.advanceTimersByTime(1)
    })
    expect(screen.getByRole("dialog", { name: "Choose champion" })).toBeTruthy()
  })

  it("filters the grid by search text", () => {
    // Given an open picker
    renderPicker(vi.fn())
    fireEvent.click(screen.getByRole("button", { name: "Choose champion" }))

    // When searching for "ya"
    fireEvent.change(screen.getByRole("textbox", { name: "Search" }), { target: { value: "ya" } })

    // Then only the matching champion remains
    expect(screen.getByText("Yasuo")).toBeTruthy()
    expect(screen.queryByText("Vayne")).toBeNull()
    expect(screen.queryByText("Garen")).toBeNull()
  })

  it("AND-combines multiple active filters and resets them when Clear filters is clicked", () => {
    // Given an open picker with no active filters (Clear filters starts disabled)
    renderPicker(vi.fn())
    fireEvent.click(screen.getByRole("button", { name: "Choose champion" }))
    const clearButton = screen.getByRole("button", { name: "Clear filters" }) as HTMLButtonElement
    expect(clearButton.disabled).toBe(true)

    // When the "Top" and "Modeled" filters are activated
    fireEvent.click(screen.getByRole("button", { name: "Top" }))
    expect(screen.getByText("Yasuo")).toBeTruthy()
    expect(screen.getByText("Garen")).toBeTruthy()
    expect(screen.queryByText("Vayne")).toBeNull()
    fireEvent.click(screen.getByRole("button", { name: "Modeled" }))

    // Then only champions matching BOTH filters remain and Clear filters is enabled
    expect(screen.getByText("Yasuo")).toBeTruthy()
    expect(screen.queryByText("Garen")).toBeNull()
    expect(screen.queryByText("Vayne")).toBeNull()
    expect(clearButton.disabled).toBe(false)

    // When Clear filters is clicked, all items return and the button disables again
    fireEvent.click(clearButton)
    expect(screen.getByText("Vayne")).toBeTruthy()
    expect(screen.getByText("Garen")).toBeTruthy()
    expect(clearButton.disabled).toBe(true)
  })

  it("shows the empty-results state when nothing matches", () => {
    // Given an open picker
    renderPicker(vi.fn())
    fireEvent.click(screen.getByRole("button", { name: "Choose champion" }))

    // When searching for something that matches nothing
    fireEvent.change(screen.getByRole("textbox", { name: "Search" }), { target: { value: "zzz" } })

    // Then the empty state renders instead of the grid
    expect(screen.getByText("No results")).toBeTruthy()
  })

  it("does not select a disabled item and marks it aria-disabled with a badge", () => {
    // Given an open picker
    const onSelect = vi.fn()
    renderPicker(onSelect)
    fireEvent.click(screen.getByRole("button", { name: "Choose champion" }))

    // When the unmodeled (disabled) champion is clicked
    const garenButton = screen.getByText("Garen").closest("button")
    expect(garenButton?.getAttribute("aria-disabled")).toBe("true")
    fireEvent.click(garenButton as HTMLButtonElement)

    // Then onSelect never fires and the badge is visible
    expect(onSelect).not.toHaveBeenCalled()
    expect(screen.getByText("Not modeled")).toBeTruthy()
  })

  it("selects an enabled item and closes the popover", () => {
    // Given an open picker
    const onSelect = vi.fn()
    renderPicker(onSelect)
    fireEvent.click(screen.getByRole("button", { name: "Choose champion" }))

    // When the enabled champion is clicked
    fireEvent.click(screen.getByText("Yasuo").closest("button") as HTMLButtonElement)

    // Then onSelect fires with it and the popover closes
    expect(onSelect).toHaveBeenCalledWith(CHAMPIONS[0])
    expect(screen.queryByRole("dialog")).toBeNull()
  })

  it("closes on Escape and returns focus to the trigger", () => {
    // Given an open picker
    renderPicker(vi.fn())
    const trigger = screen.getByRole("button", { name: "Choose champion" })
    fireEvent.click(trigger)
    expect(screen.getByRole("dialog")).toBeTruthy()

    // When Escape is pressed
    fireEvent.keyDown(document, { key: "Escape" })

    // Then the popover closes and focus returns to the trigger
    expect(screen.queryByRole("dialog")).toBeNull()
    expect(document.activeElement).toBe(trigger)
  })

  it("uses itemLabel as each cell's accessible name and shows it as a tooltip on focus", () => {
    // Given an open picker whose cells are icon-only, labeled via itemLabel
    render(
      <HoverPicker
        trigger={<span>Portrait</span>}
        items={CHAMPIONS}
        getKey={(champion) => champion.id}
        renderItem={() => null}
        itemLabel={(champion) =>
          champion.modeled ? champion.name : `${champion.name} (unmodeled)`
        }
        searchText={(champion) => champion.name}
        onSelect={vi.fn()}
        compact
        aria-label="Choose champion"
      />,
    )
    fireEvent.click(screen.getByRole("button", { name: "Choose champion" }))
    const garen = screen.getByRole("button", { name: "Garen (unmodeled)" })

    // When a cell is focused for the tooltip delay
    fireEvent.focus(garen)
    act(() => {
      vi.advanceTimersByTime(400)
    })

    // Then its label shows as a tooltip
    expect(screen.getByRole("tooltip").textContent).toBe("Garen (unmodeled)")
  })

  it("traps Tab: from the last focusable element it wraps back to the first", () => {
    // Given an open picker with focus on its last focusable element. The
    // grid uses roving tabindex (ARIA grid pattern), so only the active
    // item — Yasuo, index 0 by default — is a real Tab stop; the others
    // are reachable by arrow keys, not Tab.
    renderPicker(vi.fn())
    fireEvent.click(screen.getByRole("button", { name: "Choose champion" }))
    const searchInput = screen.getByRole("textbox", { name: "Search" })
    const lastItem = screen.getByText("Yasuo").closest("button") as HTMLButtonElement
    lastItem.focus()

    // When Tab is pressed
    fireEvent.keyDown(document, { key: "Tab" })

    // Then focus wraps back to the first focusable element (search) instead of leaving the popover
    expect(document.activeElement).toBe(searchInput)
  })

  it("traps Shift+Tab: from the first focusable element it wraps back to the last", () => {
    // Given an open picker with focus on its first focusable element (search)
    renderPicker(vi.fn())
    fireEvent.click(screen.getByRole("button", { name: "Choose champion" }))
    const searchInput = screen.getByRole("textbox", { name: "Search" })
    const lastItem = screen.getByText("Yasuo").closest("button") as HTMLButtonElement
    searchInput.focus()

    // When Shift+Tab is pressed
    fireEvent.keyDown(document, { key: "Tab", shiftKey: true })

    // Then focus wraps back to the last focusable element instead of leaving the popover
    expect(document.activeElement).toBe(lastItem)
  })

  it("preloads item icon URLs immediately on trigger pointer enter before the popover opens", () => {
    // Given a closed picker with an imageUrl extractor
    const preloadSpy = vi.spyOn(preloadModule, "preloadImages")
    render(
      <HoverPicker
        trigger={<span>Portrait</span>}
        items={CHAMPIONS}
        getKey={(champion) => champion.id}
        renderItem={(champion) => champion.name}
        imageUrl={(champion) => `https://cdn.example/${champion.id}.png`}
        searchText={(champion) => champion.name}
        onSelect={vi.fn()}
        aria-label="Choose champion"
      />,
    )
    preloadSpy.mockClear()

    // When the pointer enters the trigger (before the 150ms open delay completes)
    fireEvent.pointerEnter(screen.getByRole("button", { name: "Choose champion" }))

    // Then preloadImages is invoked immediately with every item's imageUrl while still closed
    expect(screen.queryByRole("dialog")).toBeNull()
    expect(preloadSpy).toHaveBeenCalledWith([
      "https://cdn.example/yasuo.png",
      "https://cdn.example/vayne.png",
      "https://cdn.example/garen.png",
    ])
    preloadSpy.mockRestore()
  })
})
