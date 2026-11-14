import type { Edge, Node } from "@xyflow/react"
import type { FlowEdgeData } from "@/components/FlowEdge"
import type { ComboStep, TargetSpec } from "@/engine"

/**
 * Graph domain model (plan §5, §6). The Zustand store (`store.ts`) holds
 * exactly these shapes as its canonical state — every number a node
 * displays beyond this is re-derived live by `src/graph/*-cache.ts` and
 * `selectors.ts`, never stored.
 */

export type AbilitySlotWithRank = "Q" | "W" | "E" | "R"

/** An item id (`ItemData.id`, e.g. `3031` for Infinity Edge) or an empty
 * slot. Resolved to an item *name* (what `buildKit` actually expects) only
 * at kit-build time — see `kit-cache.ts`. */
export type ItemSlotValue = number | null

export const ITEM_SET_SIZE = 6

export type ItemSet = {
  readonly id: string
  readonly name: string
  readonly items: readonly [
    ItemSlotValue,
    ItemSlotValue,
    ItemSlotValue,
    ItemSlotValue,
    ItemSlotValue,
    ItemSlotValue,
  ]
  readonly rankOverrides: Partial<Record<AbilitySlotWithRank, number>>
}

export type ChampionNodeData = {
  readonly championId: string
  readonly level: number
  readonly itemSets: readonly ItemSet[]
}

export type ComboNodeData = {
  readonly name: string
  readonly steps: readonly ComboStep[]
  /** Champion node ids whose ability-palette `Collapsible` section is collapsed. */
  readonly collapsedSections: readonly string[]
}

export type ChartType = "cumulative" | "hp"
export type XMode = "step" | "tick"

export type GraphNodeData = {
  readonly targets: readonly TargetSpec[]
  readonly activeTargetIds: readonly string[]
  readonly chartType: ChartType
  readonly xMode: XMode
}

export type ChampionFlowNode = Node<ChampionNodeData, "champion">
export type ComboFlowNode = Node<ComboNodeData, "combo">
export type GraphFlowNode = Node<GraphNodeData, "graph">
export type FlowNode = ChampionFlowNode | ComboFlowNode | GraphFlowNode

export type FlowEdge = Edge<FlowEdgeData, "flow">

export function isChampionNode(node: FlowNode): node is ChampionFlowNode {
  return node.type === "champion"
}

export function isComboNode(node: FlowNode): node is ComboFlowNode {
  return node.type === "combo"
}

export function isGraphNode(node: FlowNode): node is GraphFlowNode {
  return node.type === "graph"
}
