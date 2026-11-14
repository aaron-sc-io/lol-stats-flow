/**
 * Pure geometry for positioning a portal-rendered floating element (Tooltip,
 * Listbox popover, HoverPicker popover) relative to its trigger. No DOM
 * access — callers pass measured `DOMRect`-shaped data in, so this stays a
 * plain, fast-to-test function.
 *
 * Strategy: try the requested side; if it would overflow the viewport on
 * that axis, flip to the opposite side; finally clamp into the viewport
 * with a small margin so the element is never partially off-screen.
 */

export type Placement = "bottom" | "right"

export type FloatingRect = {
  readonly top: number
  readonly left: number
  readonly width: number
  readonly height: number
}

export type FloatingSize = {
  readonly width: number
  readonly height: number
}

export type ViewportSize = {
  readonly width: number
  readonly height: number
}

export type FloatingPosition = {
  readonly top: number
  readonly left: number
}

const VIEWPORT_MARGIN = 8
const DEFAULT_GAP = 8

export function computeFloatingPosition(options: {
  readonly trigger: FloatingRect
  readonly floating: FloatingSize
  readonly placement: Placement
  readonly viewport: ViewportSize
  readonly gap?: number
}): FloatingPosition {
  const gap = options.gap ?? DEFAULT_GAP
  const { trigger, floating, viewport, placement } = options

  const primary = sideFor(placement, trigger, floating, gap)
  const flipped = sideFor(placement, trigger, floating, gap, true)

  const chosen =
    overflowsOnAxis(placement, primary, floating, viewport) && fitsOnAxis(placement, flipped)
      ? flipped
      : primary

  return clampToViewport(chosen, floating, viewport)
}

function sideFor(
  placement: Placement,
  trigger: FloatingRect,
  floating: FloatingSize,
  gap: number,
  flip = false,
): FloatingPosition {
  if (placement === "bottom") {
    return flip
      ? { top: trigger.top - floating.height - gap, left: trigger.left }
      : { top: trigger.top + trigger.height + gap, left: trigger.left }
  }
  return flip
    ? { top: trigger.top, left: trigger.left - floating.width - gap }
    : { top: trigger.top, left: trigger.left + trigger.width + gap }
}

function overflowsOnAxis(
  placement: Placement,
  position: FloatingPosition,
  floating: FloatingSize,
  viewport: ViewportSize,
): boolean {
  return placement === "bottom"
    ? position.top + floating.height > viewport.height
    : position.left + floating.width > viewport.width
}

function fitsOnAxis(placement: Placement, position: FloatingPosition): boolean {
  return placement === "bottom" ? position.top >= 0 : position.left >= 0
}

function clampToViewport(
  position: FloatingPosition,
  floating: FloatingSize,
  viewport: ViewportSize,
): FloatingPosition {
  const maxLeft = Math.max(VIEWPORT_MARGIN, viewport.width - floating.width - VIEWPORT_MARGIN)
  const maxTop = Math.max(VIEWPORT_MARGIN, viewport.height - floating.height - VIEWPORT_MARGIN)
  return {
    left: clamp(position.left, VIEWPORT_MARGIN, maxLeft),
    top: clamp(position.top, VIEWPORT_MARGIN, maxTop),
  }
}

function clamp(value: number, min: number, max: number): number {
  return Math.min(Math.max(value, min), max)
}
