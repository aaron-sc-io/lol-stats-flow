import type { CanonicalEdge, CanonicalGraph, CanonicalNode } from "./store-types"
import type { ChampionFlowNode, ComboFlowNode, FlowEdge, FlowNode, GraphFlowNode } from "./types"

/** Replaces one node's `data` by id, leaving every other node untouched —
 * the shared update primitive every domain slice builds its actions on. */
export function mapNode<TNode extends FlowNode>(
  nodes: readonly FlowNode[],
  nodeId: string,
  isMatch: (node: FlowNode) => node is TNode,
  update: (node: TNode) => TNode,
): FlowNode[] {
  return nodes.map((node) => (node.id === nodeId && isMatch(node) ? update(node) : node))
}

export function isChampionFlowNode(node: FlowNode): node is ChampionFlowNode {
  return node.type === "champion"
}

export function isComboFlowNode(node: FlowNode): node is ComboFlowNode {
  return node.type === "combo"
}

export function isGraphFlowNode(node: FlowNode): node is GraphFlowNode {
  return node.type === "graph"
}

export function generateId(prefix: string): string {
  return `${prefix}-${crypto.randomUUID()}`
}

/** Strips one node down to the fields that are canonical user input —
 * `id`/`type`/`position`/`data` — dropping React Flow's own transient
 * bookkeeping (`selected`, `dragging`, `measured`, `zIndex`, …). An
 * if-chain over the existing `isXFlowNode` guards (not a `switch`) to
 * match this file's/`selectors.ts`'s established node-discrimination
 * style; each branch narrows `node` first, so `data`'s type always
 * matches the literal `type` it's paired with. */
export function toCanonicalNode(node: FlowNode): CanonicalNode {
  if (isChampionFlowNode(node)) {
    return { id: node.id, type: "champion", position: node.position, data: node.data }
  }
  if (isComboFlowNode(node)) {
    return { id: node.id, type: "combo", position: node.position, data: node.data }
  }
  return { id: node.id, type: "graph", position: node.position, data: node.data }
}

/** Strips one edge down to its canonical shape, dropping `FlowEdgeData`
 * entirely — `highlighted`/`dimmed` are derived live from Graph-node hover
 * state (DESIGN.md §6 upstream highlight), never user input. `undefined`
 * handle ids are normalized to `null` so the canonical projection
 * JSON-stringifies identically regardless of which one React Flow happened
 * to produce — `zundo`'s `equality` check in `store.ts` relies on that. */
export function toCanonicalEdge(edge: FlowEdge): CanonicalEdge {
  return {
    id: edge.id,
    source: edge.source,
    sourceHandle: edge.sourceHandle ?? null,
    target: edge.target,
    targetHandle: edge.targetHandle ?? null,
    type: "flow",
  }
}

/** The one canonicalization used both for undo-history tracking
 * (`store.ts`'s zundo `partialize`) and for everything `src/persistence/`
 * saves/exports/shares — a single source of truth so the two never drift
 * into recording/persisting different shapes. */
export function toCanonicalGraph(
  nodes: readonly FlowNode[],
  edges: readonly FlowEdge[],
): CanonicalGraph {
  return {
    nodes: nodes.map(toCanonicalNode),
    edges: edges.map(toCanonicalEdge),
  }
}
