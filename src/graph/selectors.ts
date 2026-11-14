import type { ComboStep, TargetSpec } from "@/engine"
import { COMBO_SOURCES_HANDLE, GRAPH_COMBOS_HANDLE, parseItemSetHandleId } from "./handle-ids"
import {
  type ChampionFlowNode,
  type ComboFlowNode,
  type FlowEdge,
  type FlowNode,
  type ItemSet,
  isChampionNode,
  isComboNode,
  isGraphNode,
} from "./types"

export type ConnectedItemSetSource = {
  readonly itemSetId: string
  readonly itemSet: ItemSet
  readonly championNode: ChampionFlowNode
}

/** Every itemSet currently wired into a combo's `sources` handle, resolved
 * to the owning champion node + itemSet record (plan §5: a combo may accept
 * item sets from one or more different champions). */
export function getConnectedItemSetSources(
  comboNodeId: string,
  nodes: readonly FlowNode[],
  edges: readonly FlowEdge[],
): ConnectedItemSetSource[] {
  const championNodes = nodes.filter(isChampionNode)
  const sources: ConnectedItemSetSource[] = []
  for (const edge of edges) {
    if (edge.target !== comboNodeId || edge.targetHandle !== COMBO_SOURCES_HANDLE) {
      continue
    }
    const itemSetId = parseItemSetHandleId(edge.sourceHandle)
    if (itemSetId === null) {
      continue
    }
    const championNode = championNodes.find((node) => node.id === edge.source)
    const itemSet = championNode?.data.itemSets.find((set) => set.id === itemSetId)
    if (championNode !== undefined && itemSet !== undefined) {
      sources.push({ itemSetId, itemSet, championNode })
    }
  }
  return sources
}

/** A step is orphaned once its source itemSet's edge into the combo no
 * longer exists — kept in `steps`, greyed, excluded from simulation, and
 * automatically "restored" the instant a matching edge reappears (plan §5),
 * all without any separate stored flag. */
export function isStepOrphaned(
  step: ComboStep,
  connectedSources: readonly ConnectedItemSetSource[],
): boolean {
  return !connectedSources.some((source) => source.itemSetId === step.sourceId)
}

/** Combo node ids currently wired into a graph's `combos` handle, in edge
 * order (stable enough for consistent chart-series ordering). */
export function getConnectedComboIds(graphNodeId: string, edges: readonly FlowEdge[]): string[] {
  return edges
    .filter((edge) => edge.target === graphNodeId && edge.targetHandle === GRAPH_COMBOS_HANDLE)
    .map((edge) => edge.source)
}

export function getComboNodeById(
  nodeId: string,
  nodes: readonly FlowNode[],
): ComboFlowNode | undefined {
  return nodes.filter(isComboNode).find((node) => node.id === nodeId)
}

/** The active target of the first graph a combo feeds into (plan §6:
 * "DamageTypeChip with damage vs the graph's active target"). A combo isn't
 * required to be connected to a graph yet, so this returns `undefined`
 * rather than a placeholder target. */
export function getConnectedGraphTarget(
  comboNodeId: string,
  nodes: readonly FlowNode[],
  edges: readonly FlowEdge[],
): TargetSpec | undefined {
  const graphEdge = edges.find(
    (edge) => edge.source === comboNodeId && edge.targetHandle === GRAPH_COMBOS_HANDLE,
  )
  if (graphEdge === undefined) {
    return undefined
  }
  const graphNode = nodes.filter(isGraphNode).find((node) => node.id === graphEdge.target)
  return graphNode?.data.targets.find((target) => target.id === graphNode.data.activeTargetId)
}

export type HighlightState = {
  readonly highlightedNodeIds: ReadonlySet<string>
  readonly highlightedItemSetIds: ReadonlySet<string>
  readonly highlightedEdgeIds: ReadonlySet<string>
  readonly dimmedNodeIds: ReadonlySet<string>
}

const EMPTY_HIGHLIGHT: HighlightState = {
  highlightedNodeIds: new Set(),
  highlightedItemSetIds: new Set(),
  highlightedEdgeIds: new Set(),
  dimmedNodeIds: new Set(),
}

/** DESIGN.md §6/plan D11: hovering a combo (legend or chart series)
 * highlights that combo node, its connected item-set rows, their champion
 * nodes, and the connecting edges; every other combo's own exclusive
 * upstream path dims instead, mirroring the chart's "hovered series full
 * opacity, everything else 25%" rule at the node-graph level. */
export function computeHighlightState(
  nodes: readonly FlowNode[],
  edges: readonly FlowEdge[],
  hoveredComboId: string | null,
): HighlightState {
  if (hoveredComboId === null) {
    return EMPTY_HIGHLIGHT
  }
  const comboNode = getComboNodeById(hoveredComboId, nodes)
  if (comboNode === undefined) {
    return EMPTY_HIGHLIGHT
  }

  const hoveredSources = getConnectedItemSetSources(hoveredComboId, nodes, edges)
  const highlightedChampionIds = new Set(hoveredSources.map((source) => source.championNode.id))
  const highlightedNodeIds = new Set<string>([hoveredComboId, ...highlightedChampionIds])
  const highlightedItemSetIds = new Set(hoveredSources.map((source) => source.itemSetId))
  const highlightedEdgeIds = new Set(
    edges
      .filter(
        (edge) => edge.target === hoveredComboId && edge.targetHandle === COMBO_SOURCES_HANDLE,
      )
      .map((edge) => edge.id),
  )

  const dimmedNodeIds = new Set<string>()
  for (const otherCombo of nodes.filter(isComboNode)) {
    if (otherCombo.id === hoveredComboId) {
      continue
    }
    dimmedNodeIds.add(otherCombo.id)
    for (const source of getConnectedItemSetSources(otherCombo.id, nodes, edges)) {
      if (!highlightedChampionIds.has(source.championNode.id)) {
        dimmedNodeIds.add(source.championNode.id)
      }
    }
  }

  return { highlightedNodeIds, highlightedItemSetIds, highlightedEdgeIds, dimmedNodeIds }
}
