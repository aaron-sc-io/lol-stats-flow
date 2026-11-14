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

/** The connected champion node a step belongs to. A step's `sourceId` is
 * the champion node id (the combo palette is one row per champion, and the
 * same step list is replayed against every connected item set of that
 * champion); canvases saved before that stored the item set id the step was
 * added from, so any item set owned by a connected champion still resolves
 * to it. `undefined` once no item set of that champion feeds the combo. */
export function resolveStepChampionNodeId(
  step: ComboStep,
  connectedSources: readonly ConnectedItemSetSource[],
): string | undefined {
  const source = connectedSources.find(
    ({ itemSetId, championNode }) =>
      championNode.id === step.sourceId ||
      itemSetId === step.sourceId ||
      championNode.data.itemSets.some((set) => set.id === step.sourceId),
  )
  return source?.championNode.id
}

/** A step is orphaned once no item set of its champion is wired into the
 * combo — kept in `steps`, greyed, excluded from simulation, and
 * automatically "restored" the instant a matching edge reappears (plan §5),
 * all without any separate stored flag.
 *
 * Also orphaned (when `kits` — keyed by champion node id — is given): the
 * step's `actionId` no longer exists in its champion's *current* kit — e.g.
 * the champion node was switched to one without that exact ability/variant
 * id (`RosterPicker` lets this happen at any time; see plan §5's "dependent
 * steps become orphaned, not silently deleted"). Without this check a stale
 * step reaches `simulate()` with an action id its new kit can't resolve.
 * `kits` is optional and back-compat-false when omitted, since not every
 * caller has a kit lookup on hand. */
export function isStepOrphaned(
  step: ComboStep,
  connectedSources: readonly ConnectedItemSetSource[],
  kits?: Readonly<Record<string, Kit>>,
): boolean {
  const championNodeId = resolveStepChampionNodeId(step, connectedSources)
  if (championNodeId === undefined) {
    return true
  }
  if (kits === undefined) {
    return false
  }
  const kit = kits[championNodeId]
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
  const firstActiveTargetId = graphNode?.data.activeTargetIds[0]
  if (firstActiveTargetId !== undefined) {
    return graphNode?.data.targets.find((target) => target.id === firstActiveTargetId)
  }
  return graphNode?.data.targets[0]
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

function computeItemSetHighlight(
  edges: readonly FlowEdge[],
  hoveredItemSetIds: readonly string[],
): HighlightState {
  const hoveredItemSetIdSet = new Set(hoveredItemSetIds)
  const feedEdges = edges.filter(
    (edge) =>
      edge.targetHandle === COMBO_SOURCES_HANDLE &&
      hoveredItemSetIdSet.has(parseItemSetHandleId(edge.sourceHandle) ?? ""),
  )
  return {
    highlightedNodeIds: new Set(feedEdges.map((edge) => edge.target)),
    highlightedItemSetIds: hoveredItemSetIdSet,
    highlightedEdgeIds: new Set(feedEdges.map((edge) => edge.id)),
    dimmedNodeIds: new Set(),
    dimmedEdgeIds: new Set(),
  }
}

/** DESIGN.md §6/plan D11: hovering a combo (legend, chart series, or the
 * combo node itself) highlights that combo node, its connected item-set
 * rows, their champion nodes, and the 2 kinds of connecting edges (incoming
 * sources + its own outgoing edge to the graph); every other combo's own
 * exclusive upstream path — and its own edges — dims instead, mirroring the
 * chart's "hovered series full opacity, everything else 25%" rule at the
 * node-graph level.
 *
 * Hovering an item-set row (when no combo is hovered) is the reverse
 * lookup: it highlights that row, every combo it feeds, and the edges
 * between them — highlight only, nothing dims. */
export function computeHighlightState(
  nodes: readonly FlowNode[],
  edges: readonly FlowEdge[],
  hoveredComboId: string | null,
  hoveredItemSetIds: readonly string[] = [],
): HighlightState {
  const hoveredItemSetIdSet = new Set(hoveredItemSetIds)
  if (hoveredComboId === null) {
    return hoveredItemSetIdSet.size === 0
      ? EMPTY_HIGHLIGHT
      : computeItemSetHighlight(edges, [...hoveredItemSetIdSet])
  }
  const comboNode = getComboNodeById(hoveredComboId, nodes)
  if (comboNode === undefined) {
    return EMPTY_HIGHLIGHT
  }

  const hoveredSources = getConnectedItemSetSources(hoveredComboId, nodes, edges)
  const relevantSources =
    hoveredItemSetIdSet.size === 0
      ? hoveredSources
      : hoveredSources.filter((source) => hoveredItemSetIdSet.has(source.itemSetId))
  const sourcesForHighlight = relevantSources.length === 0 ? hoveredSources : relevantSources
  const highlightedChampionIds = new Set(
    sourcesForHighlight.map((source) => source.championNode.id),
  )
  const highlightedNodeIds = new Set<string>([hoveredComboId, ...highlightedChampionIds])
  const highlightedItemSetIds = new Set(sourcesForHighlight.map((source) => source.itemSetId))
  const highlightedEdgeIds = new Set<string>(
    edges
      .filter((edge) => edge.source === hoveredComboId && edge.sourceHandle === COMBO_OUT_HANDLE)
      .map((edge) => edge.id),
  )
  for (const edge of edges) {
    if (edge.target !== hoveredComboId || edge.targetHandle !== COMBO_SOURCES_HANDLE) {
      continue
    }
    const itemSetId = parseItemSetHandleId(edge.sourceHandle)
    if (itemSetId !== null && highlightedItemSetIds.has(itemSetId)) {
      highlightedEdgeIds.add(edge.id)
    }
  }

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
