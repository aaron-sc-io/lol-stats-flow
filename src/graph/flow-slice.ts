import type { Connection, XYPosition } from "@xyflow/react"
import { addEdge, applyEdgeChanges, applyNodeChanges } from "@xyflow/react"
import { isValidGraphConnection } from "./connection-rules"
import { generateId, mapNode } from "./store-helpers"
import type { FlowSlice, GraphGet, GraphSet } from "./store-types"
import {
  type ChampionFlowNode,
  type ComboFlowNode,
  type FlowNode,
  type GraphFlowNode,
  type GraphKind,
  isChampionNode,
  isComboNode,
  isTutorialNode,
} from "./types"

const DUPLICATE_OFFSET = 40

/** Node/edge CRUD, React Flow's controlled-store wiring (`onNodesChange`/
 * `onEdgesChange`/`onConnect`), and the "Add node" menu's three factories.
 * `onConnect` validates against `isValidGraphConnection` *before* ever
 * calling `set`, so an invalid drag-to-connect is a pure no-op — nothing
 * for zundo to record. Removing a node also strips any edge touching it,
 * since `applyNodeChanges` alone never does (plan §5: "removing a champion
 * node or itemSet removes its edges"). */
export function createFlowSlice(set: GraphSet, get: GraphGet): FlowSlice {
  return {
    nodes: [],
    edges: [],
    hoveredComboId: null,
    hoveredGraphSeriesId: null,
    hoveredStepId: null,
    hoveredStepIds: [],
    hoveredItemSetId: null,
    hoveredItemSetIds: [],
    hoveredDamage: null,
    pinnedGraphSeriesId: null,

    onNodesChange: (changes) => {
      const removedIds = new Set(
        changes.filter((change) => change.type === "remove").map((change) => change.id),
      )
      set((state) => {
        // Champion and Combo nodes resize by width only: their height is
        // whatever their content needs, so it must stay unset — otherwise a
        // resize pins `node.height` and the node box stops tracking rows/steps
        // or overflows when dragged shorter than the content.
        const widthOnlyIds = new Set(
          state.nodes
            .filter((n) => isChampionNode(n) || isComboNode(n) || isTutorialNode(n))
            .map((node) => node.id),
        )
        const adjusted = changes.map((change) =>
          change.type === "dimensions" &&
          change.setAttributes !== undefined &&
          widthOnlyIds.has(change.id)
            ? { ...change, setAttributes: "width" as const }
            : change,
        )
        return {
          nodes: applyNodeChanges(adjusted, state.nodes),
          edges:
            removedIds.size === 0
              ? state.edges
              : state.edges.filter(
                  (edge) => !removedIds.has(edge.source) && !removedIds.has(edge.target),
                ),
        }
      })
    },

    onEdgesChange: (changes) => {
      set((state) => ({ edges: applyEdgeChanges(changes, state.edges) }))
    },

    onConnect: (connection: Connection) => {
      const { nodes, edges } = get()
      if (!isValidGraphConnection(connection, nodes, edges)) {
        return
      }
      set({ edges: addEdge({ ...connection, type: "flow", data: {} }, edges) })
    },

    setHoveredCombo: (comboId) => set({ hoveredComboId: comboId }),

    setHoveredGraphSeries: (seriesId) => set({ hoveredGraphSeriesId: seriesId }),

    setHoveredStep: (stepId) =>
      set({ hoveredStepId: stepId, hoveredStepIds: stepId === null ? [] : [stepId] }),

    setHoveredSteps: (stepIds) =>
      set({ hoveredStepIds: [...stepIds], hoveredStepId: stepIds[0] ?? null }),

    setHoveredItemSet: (itemSetId) =>
      set({
        hoveredItemSetId: itemSetId,
        hoveredItemSetIds: itemSetId === null ? [] : [itemSetId],
      }),

    setHoveredItemSets: (itemSetIds) =>
      set({ hoveredItemSetIds: [...itemSetIds], hoveredItemSetId: itemSetIds[0] ?? null }),

    setHoveredDamage: (damage) => set({ hoveredDamage: damage }),

    setPinnedGraphSeries: (seriesId) => set({ pinnedGraphSeriesId: seriesId }),

    addChampionNode: (position: XYPosition = { x: 0, y: 0 }) => {
      const id = generateId("champion")
      const node: ChampionFlowNode = {
        id,
        type: "champion",
        position,
        data: { championId: "Yasuo", level: 11, itemSets: [] },
      }
      set((state) => ({ nodes: [...state.nodes, node] }))
      return id
    },

    addComboNode: (position: XYPosition = { x: 0, y: 0 }) => {
      const id = generateId("combo")
      const node: ComboFlowNode = {
        id,
        type: "combo",
        position,
        data: { name: "Combo", steps: [], collapsedSections: [] },
      }
      set((state) => ({ nodes: [...state.nodes, node] }))
      return id
    },

    addGraphNode: (position: XYPosition = { x: 0, y: 0 }, graphKind: GraphKind = "targets") => {
      const id = generateId("graph")
      const targetId = generateId("target")
      const node: GraphFlowNode = {
        id,
        type: "graph",
        position,
        data: {
          ...(graphKind === "targets" ? {} : { graphKind }),
          targets: [
            { id: targetId, name: "Target 1", maxHp: 2000, bonusHp: 0, armor: 80, magicResist: 50 },
          ],
          activeTargetIds: [targetId],
          chartType: "cumulative",
          xMode: "step",
        },
      }
      set((state) => ({ nodes: [...state.nodes, node] }))
      return id
    },

    setTutorialStep: (nodeId, step) => {
      set((state) => ({
        nodes: mapNode(state.nodes, nodeId, isTutorialNode, (node) => ({
          ...node,
          data: { ...node.data, step: Math.max(0, Math.round(step)) },
        })),
      }))
    },

    removeNode: (nodeId) => {
      set((state) => ({
        nodes: state.nodes.filter((node) => node.id !== nodeId),
        edges: state.edges.filter((edge) => edge.source !== nodeId && edge.target !== nodeId),
      }))
    },

    duplicateNode: (nodeId) => {
      const original = get().nodes.find((node) => node.id === nodeId)
      if (original === undefined) {
        return undefined
      }
      const id = generateId(original.type)
      const position = {
        x: original.position.x + DUPLICATE_OFFSET,
        y: original.position.y + DUPLICATE_OFFSET,
      }
      // Fresh ids for nested records too: item-set / step ids drive the
      // canvas-wide hover linking, so sharing them would cross-highlight.
      const copy: FlowNode = isChampionNode(original)
        ? {
            ...original,
            id,
            position,
            selected: true,
            data: {
              ...original.data,
              itemSets: original.data.itemSets.map((itemSet) => ({
                ...itemSet,
                id: generateId("itemset"),
              })),
            },
          }
        : isComboNode(original)
          ? {
              ...original,
              id,
              position,
              selected: true,
              data: {
                ...original.data,
                name: `${original.data.name} (copy)`,
                steps: original.data.steps.map((step) => ({ ...step, id: generateId("step") })),
              },
            }
          : { ...original, id, position, selected: true }
      // The copy keeps its inputs (item sets feeding a combo, combos feeding
      // a graph) so it computes the same thing; outputs aren't cloned.
      const incoming = get()
        .edges.filter((edge) => edge.target === nodeId)
        .map((edge) => ({ ...edge, id: generateId("edge"), target: id, selected: false }))
      set((state) => ({
        nodes: [
          ...state.nodes.map((node) =>
            node.selected === true ? { ...node, selected: false } : node,
          ),
          copy,
        ],
        edges: [...state.edges, ...incoming],
      }))
      return id
    },
  }
}
