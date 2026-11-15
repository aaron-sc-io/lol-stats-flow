import { act, fireEvent, render, screen } from "@testing-library/react"
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest"
import {
  EXIT_DURATION_MS,
  MAX_VISIBLE_TOASTS,
  ToastProvider,
  type ToastTone,
  useToast,
} from "./Toast"

function TriggerHarness(props: {
  readonly onAction: () => void
  readonly durationMs?: number
  readonly tone?: ToastTone
}) {
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
          tone: props.tone,
        })
      }
    >
      Remove
    </button>
  )
}

function MultiTriggerHarness() {
  const { show } = useToast()
  return (
    <button
      type="button"
      onClick={() => {
        for (let index = 1; index <= MAX_VISIBLE_TOASTS + 1; index += 1) {
          show({ message: `Toast ${index}` })
        }
      }}
    >
      Burst
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
    vi.restoreAllMocks()
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

    // Then the toast message is visible in the open state
    expect(screen.getByText("Item set removed")).toBeTruthy()
    expect(screen.getByRole("status").getAttribute("data-state")).toBe("open")
  })

  it("calls the undo callback, transitions to exiting, and removes the toast after the exit animation", () => {
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

    // Then the undo callback fires immediately, the toast stays mounted while exiting, and unmounts after the exit duration
    expect(onAction).toHaveBeenCalledOnce()
    expect(screen.getByRole("status").getAttribute("data-state")).toBe("exiting")
    act(() => {
      vi.advanceTimersByTime(EXIT_DURATION_MS)
    })
    expect(screen.queryByText("Item set removed")).toBeNull()
  })

  it("auto-dismisses after its duration elapses and unmounts once the exit animation finishes", () => {
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

    // Then it enters the exiting state while remaining mounted, then unmounts after the exit animation
    expect(screen.getByRole("status").getAttribute("data-state")).toBe("exiting")
    act(() => {
      vi.advanceTimersByTime(EXIT_DURATION_MS)
    })
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

    // Then it transitions to exiting and unmounts after the exit duration
    expect(screen.getByRole("status").getAttribute("data-state")).toBe("exiting")
    act(() => {
      vi.advanceTimersByTime(EXIT_DURATION_MS)
    })
    expect(screen.queryByText("Item set removed")).toBeNull()
  })

  it("removes the toast immediately on dismiss when prefers-reduced-motion is enabled", () => {
    // Given prefers-reduced-motion: reduce is active
    const originalMatchMedia = window.matchMedia
    Object.defineProperty(window, "matchMedia", {
      configurable: true,
      writable: true,
      value: (query: string) => ({
        matches: query === "(prefers-reduced-motion: reduce)",
        media: query,
        onchange: null,
        addListener: vi.fn(),
        removeListener: vi.fn(),
        addEventListener: vi.fn(),
        removeEventListener: vi.fn(),
        dispatchEvent: vi.fn(() => false),
      }),
    })
    try {
      render(
        <ToastProvider>
          <TriggerHarness onAction={vi.fn()} />
        </ToastProvider>,
      )
      fireEvent.click(screen.getByRole("button", { name: "Remove" }))
      expect(screen.getByText("Item set removed")).toBeTruthy()

      // When its dismiss button is clicked
      fireEvent.click(screen.getByRole("button", { name: "Dismiss" }))

      // Then it unmounts immediately without waiting for the exit timer
      expect(screen.queryByText("Item set removed")).toBeNull()
    } finally {
      Object.defineProperty(window, "matchMedia", {
        configurable: true,
        writable: true,
        value: originalMatchMedia,
      })
    }
  })

  it("caps the visible stack at 5 and drops the oldest when a 6th toast arrives", () => {
    // Given a provider and a trigger that enqueues 6 toasts
    render(
      <ToastProvider>
        <MultiTriggerHarness />
      </ToastProvider>,
    )

    // When 6 toasts are shown
    fireEvent.click(screen.getByRole("button", { name: "Burst" }))

    // Then only the newest 5 remain and the oldest is dropped
    expect(screen.getAllByRole("status")).toHaveLength(MAX_VISIBLE_TOASTS)
    expect(screen.queryByText("Toast 1")).toBeNull()
    expect(screen.getByText("Toast 2")).toBeTruthy()
    expect(screen.getByText(`Toast ${MAX_VISIBLE_TOASTS + 1}`)).toBeTruthy()
  })

  it("renders error tone styling when tone is error", () => {
    // Given a provider and a trigger that shows an error toast
    render(
      <ToastProvider>
        <TriggerHarness onAction={vi.fn()} tone="error" />
      </ToastProvider>,
    )

    // When the error toast is triggered
    fireEvent.click(screen.getByRole("button", { name: "Remove" }))

    // Then the toast exposes data-tone="error"
    expect(screen.getByRole("status").getAttribute("data-tone")).toBe("error")
  })

  it("throws when used outside a ToastProvider", () => {
    // Given a component that calls useToast() with no provider above it
    // When it renders
    // Then it throws a clear, actionable error instead of silently no-opping
    expect(() => render(<Bare />)).toThrow("useToast must be used within a <ToastProvider>")
  })
})
