import { renderHook } from "@testing-library/react"
import { afterEach, describe, expect, it, vi } from "vitest"
import { useFocusTrap } from "./use-focus-trap"

function buildDrawerDom(): {
  readonly container: HTMLDivElement
  readonly closeButton: HTMLButtonElement
  readonly searchInput: HTMLInputElement
} {
  const container = document.createElement("div")
  container.innerHTML = `
    <button id="close">close</button>
    <input id="search" />
    <button id="new-canvas">new</button>
  `
  document.body.appendChild(container)
  const closeButton = container.querySelector<HTMLButtonElement>("#close")
  const searchInput = container.querySelector<HTMLInputElement>("#search")
  if (closeButton === null || searchInput === null) {
    throw new Error("buildDrawerDom: fixture markup is missing an expected element")
  }
  return { container, closeButton, searchInput }
}

afterEach(() => {
  document.body.innerHTML = ""
})

describe("useFocusTrap", () => {
  it("focuses initialFocusRef's element instead of the first focusable element in DOM order", () => {
    const { container, searchInput } = buildDrawerDom()

    renderHook(() =>
      useFocusTrap({
        containerRef: { current: container },
        active: true,
        onEscape: vi.fn(),
        initialFocusRef: { current: searchInput },
      }),
    )

    expect(document.activeElement).toBe(searchInput)
  })

  it("falls back to the first focusable element in DOM order when initialFocusRef is not given", () => {
    const { container, closeButton } = buildDrawerDom()

    renderHook(() =>
      useFocusTrap({ containerRef: { current: container }, active: true, onEscape: vi.fn() }),
    )

    expect(document.activeElement).toBe(closeButton)
  })
})
