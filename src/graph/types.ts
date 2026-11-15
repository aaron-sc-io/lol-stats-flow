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
export type SeriesDashStyle = "solid" | "dashed" | "dotted"
export type SeriesMarkerShape = "circle" | "square" | "diamond"

export type SeriesOverride = {
  readonly color?: string | undefined
  readonly strokeWidth?: number | undefined
  readonly dashStyle?: SeriesDashStyle | undefined
  readonly shape?: SeriesMarkerShape | undefined
  readonly hidden?: boolean | undefined
}

/** "targets" — "Graph: Combo Damage vs Targets" (damage over combo steps
 * against each target's own armor/MR). "resists" — "Graph: Effective
 * Damage" (total combo damage swept across 0–400 armor/MR). Absent means
 * "targets", so canvases saved before this field existed keep working. */
export type GraphKind = "targets" | "resists"

/** "Graph: Effective Damage" settings. `resistAxis` — which resistance the
 * sweep varies (the other stays at each target's own value). `view` —
 * "curves" (% of target HP dealt vs resist, one line per combo variant ×
 * target, with a live resist cursor) or "killMap" (HP × resist grid
 * comparing two combo variants' kill outcomes). `killMapA`/`killMapB` —
 * `${comboId}__${variantId}` keys. */
export type ResistAxis = "armor" | "magicResist"
export type EffectiveView = "curves" | "killMap"
export type EffectiveSettings = {
  readonly resistAxis?: ResistAxis | undefined
  readonly view?: EffectiveView | undefined
  readonly killMapA?: string | undefined
  readonly killMapB?: string | undefined
}

export type GraphNodeData = {
  readonly graphKind?: GraphKind | undefined
  readonly effective?: EffectiveSettings | undefined
  readonly targets: readonly TargetSpec[]
  readonly activeTargetIds: readonly string[]
  readonly chartType: ChartType
  readonly xMode: XMode
  readonly seriesOverrides?: Readonly<Record<string, SeriesOverride>> | undefined
}

/** The step-by-step walkthrough shown on the "Tutorial" canvas. Not offered
 * in the Add Node menu — it only exists on canvases built by
 * `createTutorialCanvas`. `step` is the 0-based page the user is on. */
export type TutorialNodeData = {
  readonly step: number
}

export type ChampionFlowNode = Node<ChampionNodeData, "champion">
export type ComboFlowNode = Node<ComboNodeData, "combo">
export type GraphFlowNode = Node<GraphNodeData, "graph">
export type TutorialFlowNode = Node<TutorialNodeData, "tutorial">
export type FlowNode = ChampionFlowNode | ComboFlowNode | GraphFlowNode | TutorialFlowNode

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

export function isTutorialNode(node: FlowNode): node is TutorialFlowNode {
  return node.type === "tutorial"
}
