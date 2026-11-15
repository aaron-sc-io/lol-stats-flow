import type { Connection, OnEdgesChange, OnNodesChange, XYPosition } from "@xyflow/react"
import type { ComboStep } from "@/engine"
import type {
  AbilitySlotWithRank,
  ChampionNodeData,
  ChartType,
  ComboNodeData,
  EffectiveSettings,
  FlowEdge,
  FlowNode,
  GraphKind,
  GraphNodeData,
  ItemSlotValue,
  SeriesOverride,
  TutorialNodeData,
  XMode,
} from "./types"

export type ComboStepInput = ComboStep

/**
 * The subset of a `FlowNode`/`FlowEdge` that is safe to persist or record
 * in undo history (plan D14 deliverable 4: "Exclude transient UI state —
 * hover, selection, open popovers — from history and from saved docs").
 * React Flow's own `Node`/`Edge` carry extra transient fields
 * (`selected`, `dragging`, `measured`, `zIndex`, …) and `FlowEdgeData`
 * carries derived hover state (`highlighted`/`dimmed`, set live by the
 * Graph's upstream-highlight feature) — none of that belongs in a saved
 * canvas or an undo checkpoint. `src/graph/store-helpers.ts`'s
 * `toCanonicalGraph` is the one place this projection is built; the Zod
 * schema in `src/persistence/schema.ts` mirrors this shape independently
 * (persistence depends on graph, never the other way).
 */
export type CanonicalNode =
  | {
      readonly id: string
      readonly type: "champion"
      readonly position: XYPosition
      readonly data: ChampionNodeData
    }
  | {
      readonly id: string
      readonly type: "combo"
      readonly position: XYPosition
      readonly data: ComboNodeData
    }
  | {
      readonly id: string
      readonly type: "graph"
      readonly position: XYPosition
      readonly data: GraphNodeData
    }
  | {
      readonly id: string
      readonly type: "tutorial"
      readonly position: XYPosition
      readonly data: TutorialNodeData
    }

export type CanonicalEdge = {
  readonly id: string
  readonly source: string
  readonly sourceHandle: string | null
  readonly target: string
  readonly targetHandle: string | null
  readonly type: "flow"
}

export type CanonicalGraph = {
  readonly nodes: readonly CanonicalNode[]
  readonly edges: readonly CanonicalEdge[]
}

/** Minimal structural `set`/`get` shapes every slice needs — compatible
 * with zustand's real (wider) `set`/`get` signatures by function-parameter
 * contravariance, so slices stay decoupled from the temporal middleware's
 * mutator-tuple generics. */
export type GraphSet = (
  partial: Partial<GraphState> | ((state: GraphState) => Partial<GraphState>),
) => void
export type GraphGet = () => GraphState

/** One hovered chart line segment — a single point's worth of damage on one
 * graph series — and the combo-timeline damage chip it maps back to
 * (`comboId` × `variantId` × `stepId`). Transient hover state only. */
export type HoveredDamage = {
  readonly seriesId: string
  readonly comboId: string
  readonly variantId: string
  /** The combo step that dealt this damage — `null` only if a point has no
   * owning step (never for real step/tick points). */
  readonly stepId: string | null
  /** The merged chart row's `x` (step index or tick seconds). */
  readonly x: number
}

export type FlowSlice = {
  readonly nodes: FlowNode[]
  readonly edges: FlowEdge[]
  readonly hoveredComboId: string | null
  readonly hoveredGraphSeriesId: string | null
  readonly hoveredStepId: string | null
  readonly hoveredStepIds: readonly string[]
  readonly hoveredItemSetId: string | null
  readonly hoveredItemSetIds: readonly string[]
  readonly hoveredDamage: HoveredDamage | null
  readonly pinnedGraphSeriesId: string | null
  readonly onNodesChange: OnNodesChange<FlowNode>
  readonly onEdgesChange: OnEdgesChange<FlowEdge>
  readonly onConnect: (connection: Connection) => void
  readonly setHoveredCombo: (comboId: string | null) => void
  readonly setHoveredGraphSeries: (seriesId: string | null) => void
  readonly setHoveredStep: (stepId: string | null) => void
  readonly setHoveredSteps: (stepIds: readonly string[]) => void
  readonly setHoveredItemSet: (itemSetId: string | null) => void
  readonly setHoveredItemSets: (itemSetIds: readonly string[]) => void
  readonly setHoveredDamage: (damage: HoveredDamage | null) => void
  readonly setPinnedGraphSeries: (seriesId: string | null) => void
  readonly addChampionNode: (position?: XYPosition) => string
  readonly addComboNode: (position?: XYPosition) => string
  readonly addGraphNode: (position?: XYPosition, graphKind?: GraphKind) => string
  readonly setTutorialStep: (nodeId: string, step: number) => void
  readonly removeNode: (nodeId: string) => void
  /** Clones a node (offset, selected, with its incoming edges); returns the
   * new id, or `undefined` if `nodeId` doesn't exist. */
  readonly duplicateNode: (nodeId: string) => string | undefined
}

export type ChampionSlice = {
  readonly setChampionId: (nodeId: string, championId: string) => void
  readonly setChampionLevel: (nodeId: string, level: number) => void
  readonly addItemSet: (nodeId: string) => void
  readonly removeItemSet: (nodeId: string, itemSetId: string) => void
  readonly duplicateItemSet: (nodeId: string, itemSetId: string) => void
  readonly reorderItemSets: (nodeId: string, fromIndex: number, toIndex: number) => void
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
  readonly toggleComboSectionCollapsed: (nodeId: string, sectionId: string) => void
}

export type TargetStatField =
  | "maxHp"
  | "bonusHp"
  | "armor"
  | "bonusArmor"
  | "magicResist"
  | "bonusMagicResist"

export type TargetPreset = {
  readonly maxHp: number
  readonly armor: number
  readonly magicResist: number
  readonly bonusArmor?: number
  readonly bonusMagicResist?: number
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
  readonly toggleActiveTarget: (nodeId: string, targetId: string) => void
  readonly setAllTargetsActive: (nodeId: string) => void
  readonly setChartType: (nodeId: string, chartType: ChartType) => void
  readonly setXMode: (nodeId: string, xMode: XMode) => void
  readonly setEffectiveSettings: (nodeId: string, settings: Partial<EffectiveSettings>) => void
  readonly updateSeriesOverride: (
    nodeId: string,
    seriesId: string,
    override: Partial<SeriesOverride>,
  ) => void
}

export type GraphState = FlowSlice &
  ChampionSlice &
  ComboSlice &
  GraphSlice &
  PersistenceBridgeSlice

/** The one seam `src/persistence/` is allowed to reach into the graph
 * store through: replacing the whole canonical graph wholesale (opening a
 * different canvas, import, decoding a share URL, patch-pin reconcile
 * emptying removed item/champion slots). Deliberately NOT a persistence
 * concern living inside `src/graph/` — it only replaces state; clearing
 * undo history around a canvas switch is the caller's job (see
 * `src/persistence/graph-bridge.ts`), same as cafe-hass's
 * `fromFlowGraph`/`reset` pattern of pairing a state replace with
 * `temporal.getState().clear()` at the call site. */
export type PersistenceBridgeSlice = {
  readonly loadCanvas: (nodes: FlowNode[], edges: FlowEdge[]) => void
}
