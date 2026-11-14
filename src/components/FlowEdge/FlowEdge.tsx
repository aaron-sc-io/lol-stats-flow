import type { Edge, EdgeProps } from "@xyflow/react"
import { getSmoothStepPath } from "@xyflow/react"
import { useMemo } from "react"
import { computeHighlightState } from "@/graph/selectors"
import { useGraphStore } from "@/graph/store"
import { cx } from "@/lib/cx"
import styles from "./FlowEdge.module.css"

export type FlowEdgeData = {
  readonly highlighted?: boolean
  readonly dimmed?: boolean
}

export type FlowEdgeType = Edge<FlowEdgeData, "flow">

/**
 * The only edge type the canvas uses (DESIGN.md §7): 1.5px smoothstep in
 * `--border-strong`, animated dash only while highlighted, dimmed to 25%
 * opacity while non-highlighted during a Graph upstream hover (plan D11,
 * Phase 4b). Reads the graph store directly to compute its own
 * highlighted/dimmed state (`computeHighlightState`, keyed by this edge's
 * own `id`) rather than depending on a caller-supplied `data.highlighted`/
 * `data.dimmed` — the only place that threads live hover state into the
 * real canvas's `<ReactFlow edges={edges}>` is `App.tsx`, which this
 * component doesn't own. An explicit `data.highlighted`/`data.dimmed`
 * (used by the gallery's demo canvas, which has no real store wiring)
 * still wins via the `||`, so both paths keep working. Renders its own
 * `<path>` directly instead of wrapping `<BaseEdge>` so
 * `data-highlighted`/`data-dimmed` can be read straight off the DOM,
 * matching the plan's e2e assertions.
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
  const nodes = useGraphStore((s) => s.nodes)
  const edges = useGraphStore((s) => s.edges)
  const hoveredComboId = useGraphStore((s) => s.hoveredComboId)
  const highlight = useMemo(
    () => computeHighlightState(nodes, edges, hoveredComboId),
    [nodes, edges, hoveredComboId],
  )

  const [path] = getSmoothStepPath({
    sourceX,
    sourceY,
    sourcePosition,
    targetX,
    targetY,
    targetPosition,
  })
  const highlighted = data?.highlighted === true || highlight.highlightedEdgeIds.has(id)
  const dimmed = data?.dimmed === true || highlight.dimmedEdgeIds.has(id)

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
