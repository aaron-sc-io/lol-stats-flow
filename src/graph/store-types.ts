import type { Connection, OnEdgesChange, OnNodesChange, XYPosition } from "@xyflow/react"
import type { ComboStep } from "@/engine"
import type {
  AbilitySlotWithRank,
  ChartType,
  FlowEdge,
  FlowNode,
  ItemSlotValue,
  XMode,
} from "./types"

export type ComboStepInput = ComboStep

/** Minimal structural `set`/`get` shapes every slice needs — compatible
 * with zustand's real (wider) `set`/`get` signatures by function-parameter
 * contravariance, so slices stay decoupled from the temporal middleware's
 * mutator-tuple generics. */
export type GraphSet = (
  partial: Partial<GraphState> | ((state: GraphState) => Partial<GraphState>),
) => void
export type GraphGet = () => GraphState

export type FlowSlice = {
  readonly nodes: FlowNode[]
  readonly edges: FlowEdge[]
  readonly hoveredComboId: string | null
  readonly hoveredStepId: string | null
  readonly onNodesChange: OnNodesChange<FlowNode>
  readonly onEdgesChange: OnEdgesChange<FlowEdge>
  readonly onConnect: (connection: Connection) => void
  readonly setHoveredCombo: (comboId: string | null) => void
  readonly setHoveredStep: (stepId: string | null) => void
  readonly addChampionNode: (position?: XYPosition) => string
  readonly addComboNode: (position?: XYPosition) => string
  readonly addGraphNode: (position?: XYPosition) => string
}

export type ChampionSlice = {
  readonly setChampionId: (nodeId: string, championId: string) => void
  readonly setChampionLevel: (nodeId: string, level: number) => void
  readonly addItemSet: (nodeId: string) => void
  readonly removeItemSet: (nodeId: string, itemSetId: string) => void
  readonly duplicateItemSet: (nodeId: string, itemSetId: string) => void
  readonly renameItemSet: (nodeId: string, itemSetId: string, name: string) => void
  readonly setItemSlot: (
    nodeId: string,
    itemSetId: string,
    slotIndex: number,
    itemId: ItemSlotValue,
  ) => void
  readonly setItemSetRankOverride: (
    nodeId: string,
    itemSetId: string,
    slot: AbilitySlotWithRank,
    rank: number | undefined,
  ) => void
}

export type ComboSlice = {
  readonly renameCombo: (nodeId: string, name: string) => void
  readonly addComboStep: (nodeId: string, sourceId: string, actionId: string) => void
  readonly removeComboStep: (nodeId: string, stepId: string) => void
  readonly restoreComboStep: (nodeId: string, step: ComboStepInput, atIndex: number) => void
  readonly reorderComboSteps: (nodeId: string, fromIndex: number, toIndex: number) => void
  readonly setComboStepDelay: (nodeId: string, stepId: string, delayMs: number) => void
  readonly toggleComboSectionCollapsed: (nodeId: string, itemSetId: string) => void
}

export type TargetStatField = "maxHp" | "bonusHp" | "armor" | "magicResist"

export type TargetPreset = {
  readonly maxHp: number
  readonly armor: number
  readonly magicResist: number
}

export type GraphSlice = {
  readonly addTarget: (nodeId: string) => void
  readonly removeTarget: (nodeId: string, targetId: string) => void
  readonly renameTarget: (nodeId: string, targetId: string, name: string) => void
  readonly updateTargetStat: (
    nodeId: string,
    targetId: string,
    field: TargetStatField,
    value: number,
  ) => void
  readonly applyTargetPreset: (nodeId: string, targetId: string, preset: TargetPreset) => void
  readonly setActiveTarget: (nodeId: string, targetId: string) => void
  readonly setChartType: (nodeId: string, chartType: ChartType) => void
  readonly setXMode: (nodeId: string, xMode: XMode) => void
}

export type GraphState = FlowSlice & ChampionSlice & ComboSlice & GraphSlice
