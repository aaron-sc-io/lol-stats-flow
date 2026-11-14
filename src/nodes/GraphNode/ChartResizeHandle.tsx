import { useReactFlow } from "@xyflow/react"
import { type KeyboardEvent, type PointerEvent, useRef } from "react"
import { cx } from "@/lib/cx"
import styles from "./GraphNode.module.css"

const KEYBOARD_STEP = 20

/** Bottom-right grip that rescales the chart on its own. Reports the drag
 * as a delta from where it started, in flow units (screen px ÷ zoom), so
 * the owner can apply it to the chart *and* grow the node to fit. Arrow
 * keys nudge it for keyboard users. */
export function ChartResizeHandle({
  height,
  minHeight,
  maxHeight,
  onResizeStart,
  onResize,
}: {
  readonly height: number
  readonly minHeight: number
  readonly maxHeight: number
  readonly onResizeStart: () => void
  readonly onResize: (deltaWidth: number, deltaHeight: number) => void
}) {
  const { getZoom } = useReactFlow()
  const drag = useRef<{ readonly x: number; readonly y: number; readonly zoom: number } | null>(
    null,
  )

  function handlePointerDown(event: PointerEvent<HTMLDivElement>) {
    event.preventDefault()
    event.stopPropagation()
    event.currentTarget.setPointerCapture(event.pointerId)
    drag.current = { x: event.clientX, y: event.clientY, zoom: getZoom() }
    onResizeStart()
  }

  function handlePointerMove(event: PointerEvent<HTMLDivElement>) {
    const start = drag.current
    if (start === null) {
      return
    }
    onResize((event.clientX - start.x) / start.zoom, (event.clientY - start.y) / start.zoom)
  }

  function handlePointerEnd(event: PointerEvent<HTMLDivElement>) {
    drag.current = null
    if (event.currentTarget.hasPointerCapture(event.pointerId)) {
      event.currentTarget.releasePointerCapture(event.pointerId)
    }
  }

  function handleKeyDown(event: KeyboardEvent<HTMLDivElement>) {
    const deltas: Record<string, readonly [number, number]> = {
      ArrowUp: [0, -KEYBOARD_STEP],
      ArrowDown: [0, KEYBOARD_STEP],
      ArrowLeft: [-KEYBOARD_STEP, 0],
      ArrowRight: [KEYBOARD_STEP, 0],
    }
    const delta = deltas[event.key]
    if (delta === undefined) {
      return
    }
    event.preventDefault()
    event.stopPropagation()
    onResizeStart()
    onResize(delta[0], delta[1])
  }

  return (
    // biome-ignore lint/a11y/useSemanticElements: an <hr> can't take focus or pointer drags; this is the ARIA window-splitter pattern.
    <div
      role="separator"
      aria-orientation="horizontal"
      aria-label="Resize chart"
      aria-valuenow={Math.round(height)}
      aria-valuemin={minHeight}
      aria-valuemax={maxHeight}
      tabIndex={0}
      className={cx(styles.chartResizeHandle, "nodrag")}
      onPointerDown={handlePointerDown}
      onPointerMove={handlePointerMove}
      onPointerUp={handlePointerEnd}
      onPointerCancel={handlePointerEnd}
      onKeyDown={handleKeyDown}
    />
  )
}
