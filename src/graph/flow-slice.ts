import type { Connection, XYPosition } from "@xyflow/react"
import { addEdge, applyEdgeChanges, applyNodeChanges } from "@xyflow/react"
import { isValidGraphConnection } from "./connection-rules"
import { generateId } from "./store-helpers"
import type { FlowSlice, GraphGet, GraphSet } from "./store-types"
import {
  type ChampionFlowNode,
  type ComboFlowNode,
  type GraphFlowNode,
  isChampionNode,
} from "./types"

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

    onNodesChange: (changes) => {
      const removedIds = new Set(
        changes.filter((change) => change.type === "remove").map((change) => change.id),
      )
      set((state) => {
        // Champion nodes resize by width only: their height is whatever
        // their (width-scaled) content needs, so it must stay unset —
        // otherwise a resize pins `node.height` and the node box (and its
        // NodeResizer outline) stops tracking rows added afterwards.
        const championIds = new Set(state.nodes.filter(isChampionNode).map((node) => node.id))
        const adjusted = changes.map((change) =>
          change.type === "dimensions" &&
          change.setAttributes !== undefined &&
          championIds.has(change.id)
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

    addGraphNode: (position: XYPosition = { x: 0, y: 0 }) => {
      const id = generateId("graph")
      const targetId = generateId("target")
      const node: GraphFlowNode = {
        id,
        type: "graph",
        position,
        data: {
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
  }
}
