import type { Edge, EdgeProps } from "@xyflow/react"
import { getSmoothStepPath } from "@xyflow/react"
import { cx } from "@/lib/cx"
import styles from "./FlowEdge.module.css"

export type FlowEdgeData = {
  readonly highlighted?: boolean
  readonly dimmed?: boolean
}

export type FlowEdgeType = Edge<FlowEdgeData, "flow">

/**
 * The only edge type the canvas uses (DESIGN.md §7): 1.5px smoothstep in
 * `--border-strong`, animated dash only while `data.highlighted`, dimmed to
 * 25% opacity while `data.dimmed` (the non-hovered-series state during a
 * Graph hover highlight, Phase 4b). Renders its own `<path>` directly
 * instead of wrapping `<BaseEdge>` so `data-highlighted`/`data-dimmed` can
 * be read straight off the DOM, matching the plan's e2e assertions.
 */
export function FlowEdge({
  id,
  sourceX,
  sourceY,
  targetX,
  targetY,
  sourcePosition,
  targetPosition,
  style,
  data,
}: EdgeProps<FlowEdgeType>) {
  const [path] = getSmoothStepPath({
    sourceX,
    sourceY,
    sourcePosition,
    targetX,
    targetY,
    targetPosition,
  })
  const highlighted = data?.highlighted === true
  const dimmed = data?.dimmed === true

  return (
    <path
      id={id}
      d={path}
      fill="none"
      style={style}
      className={cx(
        "react-flow__edge-path",
        styles.edge,
        highlighted && styles.highlighted,
        dimmed && styles.dimmed,
      )}
      data-highlighted={highlighted ? "true" : undefined}
      data-dimmed={dimmed ? "true" : undefined}
    />
  )
}
