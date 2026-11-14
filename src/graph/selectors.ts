import type { ComboStep, Kit, TargetSpec } from "@/engine"
import {
  COMBO_OUT_HANDLE,
  COMBO_SOURCES_HANDLE,
  GRAPH_COMBOS_HANDLE,
  parseItemSetHandleId,
} from "./handle-ids"
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
 * all without any separate stored flag.
 *
 * Also orphaned (when `kits` is given): the step's `actionId` no longer
 * exists in its source's *current* kit — e.g. the item set stayed
 * connected but the champion backing it was switched to one without that
 * exact ability/variant id (`RosterPicker` lets this happen at any time;
 * see plan §5's "dependent steps become orphaned, not silently deleted").
 * Without this check a stale step reaches `simulate()` with an action id
 * its new kit can't resolve. `kits` is optional and back-compat-false when
 * omitted, since not every caller has a kit lookup on hand. */
export function isStepOrphaned(
  step: ComboStep,
  connectedSources: readonly ConnectedItemSetSource[],
  kits?: Readonly<Record<string, Kit>>,
): boolean {
  const source = connectedSources.find((source) => source.itemSetId === step.sourceId)
  if (source === undefined) {
    return true
  }
  if (kits === undefined) {
    return false
  }
  const kit = kits[step.sourceId]
  return kit === undefined || !kit.actions.some((action) => action.id === step.actionId)
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
  readonly dimmedEdgeIds: ReadonlySet<string>
}

const EMPTY_HIGHLIGHT: HighlightState = {
  highlightedNodeIds: new Set(),
  highlightedItemSetIds: new Set(),
  highlightedEdgeIds: new Set(),
  dimmedNodeIds: new Set(),
  dimmedEdgeIds: new Set(),
}

/** True for an edge that is part of `comboId`'s own upstream/downstream
 * path: either a source feeding into it, or its own single edge out to a
 * Graph node. */
function edgeTouchesCombo(edge: FlowEdge, comboId: string): boolean {
  return (
    (edge.target === comboId && edge.targetHandle === COMBO_SOURCES_HANDLE) ||
    (edge.source === comboId && edge.sourceHandle === COMBO_OUT_HANDLE)
  )
}

/** DESIGN.md §6/plan D11: hovering a combo (legend or chart series)
 * highlights that combo node, its connected item-set rows, their champion
 * nodes, and the 2 kinds of connecting edges (incoming sources + its own
 * outgoing edge to the graph); every other combo's own exclusive upstream
 * path — and its own edges — dims instead, mirroring the chart's "hovered
 * series full opacity, everything else 25%" rule at the node-graph level. */
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
    edges.filter((edge) => edgeTouchesCombo(edge, hoveredComboId)).map((edge) => edge.id),
  )

  const dimmedNodeIds = new Set<string>()
  const dimmedEdgeIds = new Set<string>()
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
    for (const edge of edges) {
      if (edgeTouchesCombo(edge, otherCombo.id) && !highlightedEdgeIds.has(edge.id)) {
        dimmedEdgeIds.add(edge.id)
      }
    }
  }

  return {
    highlightedNodeIds,
    highlightedItemSetIds,
    highlightedEdgeIds,
    dimmedNodeIds,
    dimmedEdgeIds,
  }
}
