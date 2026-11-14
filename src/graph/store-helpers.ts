import type { ChampionFlowNode, ComboFlowNode, FlowNode, GraphFlowNode } from "./types"

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
