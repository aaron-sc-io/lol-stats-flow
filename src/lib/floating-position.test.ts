import { describe, expect, it } from "vitest"
import { computeFloatingPosition } from "./floating-position"

describe("computeFloatingPosition", () => {
  it("places the floating element below-left-aligned to the trigger when it fits", () => {
    // Given a trigger with room below it in a large viewport
    const trigger = { top: 100, left: 50, width: 40, height: 20 }
    const floating = { width: 200, height: 120 }
    const viewport = { width: 1600, height: 1000 }

    // When computing a "bottom" placement
    const position = computeFloatingPosition({
      trigger,
      floating,
      placement: "bottom",
      viewport,
      gap: 8,
    })

    // Then it sits directly under the trigger with the gap applied
    expect(position).toEqual({ top: 128, left: 50 })
  })

  it("places the floating element to the right of the trigger when it fits", () => {
    // Given a trigger with room to its right
    const trigger = { top: 200, left: 100, width: 32, height: 32 }
    const floating = { width: 280, height: 320 }
    const viewport = { width: 1600, height: 1000 }

    // When computing a "right" placement
    const position = computeFloatingPosition({
      trigger,
      floating,
      placement: "right",
      viewport,
      gap: 8,
    })

    // Then it sits directly to the right of the trigger with the gap applied
    expect(position).toEqual({ top: 200, left: 140 })
  })

  it("flips above the trigger when the bottom placement would overflow the viewport", () => {
    // Given a trigger near the bottom of a short viewport with no room below
    const trigger = { top: 900, left: 50, width: 40, height: 20 }
    const floating = { width: 200, height: 300 }
    const viewport = { width: 1600, height: 1000 }

    // When computing a "bottom" placement
    const position = computeFloatingPosition({
      trigger,
      floating,
      placement: "bottom",
      viewport,
      gap: 8,
    })

    // Then it flips to render above the trigger instead
    expect(position).toEqual({ top: 592, left: 50 })
  })

  it("flips to the left of the trigger when the right placement would overflow the viewport", () => {
    // Given a trigger near the right edge with no room to its right
    const trigger = { top: 200, left: 1500, width: 32, height: 32 }
    const floating = { width: 280, height: 200 }
    const viewport = { width: 1600, height: 1000 }

    // When computing a "right" placement
    const position = computeFloatingPosition({
      trigger,
      floating,
      placement: "right",
      viewport,
      gap: 8,
    })

    // Then it flips to render to the left of the trigger instead
    expect(position).toEqual({ top: 200, left: 1212 })
  })

  it("clamps into the viewport when neither the primary nor the flipped side fits", () => {
    // Given a floating element taller than the entire viewport
    const trigger = { top: 10, left: 10, width: 20, height: 20 }
    const floating = { width: 200, height: 2000 }
    const viewport = { width: 1600, height: 1000 }

    // When computing a "bottom" placement
    const position = computeFloatingPosition({
      trigger,
      floating,
      placement: "bottom",
      viewport,
      gap: 8,
    })

    // Then the top is clamped to the viewport margin instead of running off either edge
    expect(position.top).toBe(8)
    expect(position.left).toBe(10)
  })

  it("clamps the left edge so the floating element never renders off the left of the viewport", () => {
    // Given a trigger flush against the left edge
    const trigger = { top: 100, left: 0, width: 20, height: 20 }
    const floating = { width: 50, height: 50 }
    const viewport = { width: 1600, height: 1000 }

    // When computing a "right" placement that would normally sit at left: 28
    const position = computeFloatingPosition({
      trigger,
      floating,
      placement: "right",
      viewport,
      gap: 8,
    })

    // Then it still renders at left: 28 since that already respects the margin
    expect(position.left).toBe(28)
  })
})
