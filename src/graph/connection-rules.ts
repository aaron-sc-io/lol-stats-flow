import {
  COMBO_OUT_HANDLE,
  COMBO_SOURCES_HANDLE,
  GRAPH_COMBOS_HANDLE,
  parseItemSetHandleId,
} from "./handle-ids"
import type { FlowEdge, FlowNode } from "./types"

/** Structural shape shared by both `@xyflow/react`'s `Connection` (while
 * dragging a new edge) and its `Edge` (an already-committed one) — the only
 * fields `isValidGraphConnection` needs, so one function serves both the
 * live `isValidConnection` prop and the store's `onConnect` check. */
export type ConnectionLike = {
  readonly source: string
  readonly sourceHandle?: string | null
  readonly target: string
  readonly targetHandle?: string | null
}

/** Matches an edge/connection by its full (source, sourceHandle, target,
 * targetHandle) tuple — the "is this already wired up" duplicate check. */
function sameConnection(a: ConnectionLike, b: ConnectionLike): boolean {
  return (
    a.source === b.source &&
    (a.sourceHandle ?? null) === (b.sourceHandle ?? null) &&
    a.target === b.target &&
    (a.targetHandle ?? null) === (b.targetHandle ?? null)
  )
}

/** Structural shape check only (plan §5): `champion.itemSet[i] → combo.sources`
 * or `combo.out → graph.combos`. Node *types* gate this — champion nodes
 * expose no target handle and graph nodes expose no source handle, so a
 * cycle can never form regardless of handle-id namespacing. */
function matchesValidShape(connection: ConnectionLike, nodes: readonly FlowNode[]): boolean {
  if (connection.source === connection.target) {
    return false
  }
  const sourceNode = nodes.find((node) => node.id === connection.source)
  const targetNode = nodes.find((node) => node.id === connection.target)
  if (sourceNode === undefined || targetNode === undefined) {
    return false
  }
  if (
    sourceNode.type === "champion" &&
    parseItemSetHandleId(connection.sourceHandle) !== null &&
    targetNode.type === "combo" &&
    connection.targetHandle === COMBO_SOURCES_HANDLE
  ) {
    return true
  }
  return (
    sourceNode.type === "combo" &&
    connection.sourceHandle === COMBO_OUT_HANDLE &&
    targetNode.type === "graph" &&
    connection.targetHandle === GRAPH_COMBOS_HANDLE
  )
}

/** Full `isValidConnection` predicate: correct shape (handle/node-type
 * pairing) and not an exact duplicate of an existing edge. */
export function isValidGraphConnection(
  connection: ConnectionLike,
  nodes: readonly FlowNode[],
  edges: readonly FlowEdge[],
): boolean {
  if (!matchesValidShape(connection, nodes)) {
    return false
  }
  return !edges.some((edge) => sameConnection(edge, connection))
}
