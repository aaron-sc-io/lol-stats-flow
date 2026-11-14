import { act, fireEvent, render, screen } from "@testing-library/react"
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest"
import { ToastProvider, useToast } from "./Toast"

function TriggerHarness(props: { readonly onAction: () => void; readonly durationMs?: number }) {
  const { show } = useToast()
  return (
    <button
      type="button"
      onClick={() =>
        show({
          message: "Item set removed",
          actionLabel: "Undo",
          onAction: props.onAction,
          durationMs: props.durationMs,
        })
      }
    >
      Remove
    </button>
  )
}

function Bare() {
  useToast()
  return null
}

describe("Toast", () => {
  beforeEach(() => {
    vi.useFakeTimers()
  })

  afterEach(() => {
    vi.useRealTimers()
  })

  it("shows the message once show() is called", () => {
    // Given a provider and a trigger that calls show()
    render(
      <ToastProvider>
        <TriggerHarness onAction={vi.fn()} />
      </ToastProvider>,
    )

    // When the trigger fires
    fireEvent.click(screen.getByRole("button", { name: "Remove" }))

    // Then the toast message is visible
    expect(screen.getByText("Item set removed")).toBeTruthy()
  })

  it("calls the undo callback and dismisses the toast when its action is clicked", () => {
    // Given a visible toast with an Undo action
    const onAction = vi.fn()
    render(
      <ToastProvider>
        <TriggerHarness onAction={onAction} />
      </ToastProvider>,
    )
    fireEvent.click(screen.getByRole("button", { name: "Remove" }))
    expect(screen.getByText("Item set removed")).toBeTruthy()

    // When Undo is clicked
    fireEvent.click(screen.getByRole("button", { name: "Undo" }))

    // Then the undo callback fires and the toast is gone
    expect(onAction).toHaveBeenCalledOnce()
    expect(screen.queryByText("Item set removed")).toBeNull()
  })

  it("auto-dismisses after its duration elapses", () => {
    // Given a toast with a short duration
    render(
      <ToastProvider>
        <TriggerHarness onAction={vi.fn()} durationMs={1000} />
      </ToastProvider>,
    )
    fireEvent.click(screen.getByRole("button", { name: "Remove" }))
    expect(screen.getByText("Item set removed")).toBeTruthy()

    // When its duration elapses
    act(() => {
      vi.advanceTimersByTime(1000)
    })

    // Then it disappears on its own
    expect(screen.queryByText("Item set removed")).toBeNull()
  })

  it("can be dismissed manually before its duration elapses", () => {
    // Given a visible toast
    render(
      <ToastProvider>
        <TriggerHarness onAction={vi.fn()} />
      </ToastProvider>,
    )
    fireEvent.click(screen.getByRole("button", { name: "Remove" }))

    // When its dismiss button is clicked
    fireEvent.click(screen.getByRole("button", { name: "Dismiss" }))

    // Then it is gone immediately
    expect(screen.queryByText("Item set removed")).toBeNull()
  })

  it("throws when used outside a ToastProvider", () => {
    // Given a component that calls useToast() with no provider above it
    // When it renders
    // Then it throws a clear, actionable error instead of silently no-opping
    expect(() => render(<Bare />)).toThrow("useToast must be used within a <ToastProvider>")
  })
})
