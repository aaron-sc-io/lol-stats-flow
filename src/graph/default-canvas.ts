import {
  COMBO_OUT_HANDLE,
  COMBO_SOURCES_HANDLE,
  GRAPH_COMBOS_HANDLE,
  itemSetHandleId,
} from "./handle-ids"
import type { ChampionFlowNode, ComboFlowNode, FlowEdge, FlowNode, GraphFlowNode } from "./types"

/**
 * The canvas shown on first load (plan §6 "App shell" / deliverable 6):
 * Yasuo (1 item set: Infinity Edge) → Combo (Q, AA, E, Q✳) → Graph (1
 * target, 2000 HP / 80 armor / 50 MR), laid out left to right.
 */

export const DEFAULT_CHAMPION_NODE_ID = "champion-yasuo"
export const DEFAULT_ITEM_SET_ID = "itemset-infinity-edge"
export const DEFAULT_COMBO_NODE_ID = "combo-1"
export const DEFAULT_GRAPH_NODE_ID = "graph-1"
export const DEFAULT_TARGET_ID = "target-1"

const INFINITY_EDGE_ITEM_ID = 3031

export function createDefaultCanvas(): { readonly nodes: FlowNode[]; readonly edges: FlowEdge[] } {
  const championNode: ChampionFlowNode = {
    id: DEFAULT_CHAMPION_NODE_ID,
    type: "champion",
    position: { x: 0, y: 120 },
    data: {
      championId: "Yasuo",
      level: 11,
      itemSets: [
        {
          id: DEFAULT_ITEM_SET_ID,
          name: "Infinity Edge",
          items: [INFINITY_EDGE_ITEM_ID, null, null, null, null, null],
          rankOverrides: {},
        },
      ],
    },
  }

  const comboNode: ComboFlowNode = {
    id: DEFAULT_COMBO_NODE_ID,
    type: "combo",
    position: { x: 560, y: 160 },
    data: {
      name: "Combo 1",
      steps: [
        { id: "step-1", sourceId: DEFAULT_ITEM_SET_ID, actionId: "Q" },
        { id: "step-2", sourceId: DEFAULT_ITEM_SET_ID, actionId: "AA" },
        { id: "step-3", sourceId: DEFAULT_ITEM_SET_ID, actionId: "E" },
        { id: "step-4", sourceId: DEFAULT_ITEM_SET_ID, actionId: "Q-empowered" },
      ],
      collapsedSections: [],
    },
  }

  const graphNode: GraphFlowNode = {
    id: DEFAULT_GRAPH_NODE_ID,
    type: "graph",
    position: { x: 1040, y: 100 },
    data: {
      targets: [
        {
          id: DEFAULT_TARGET_ID,
          name: "Target 1",
          maxHp: 2000,
          bonusHp: 0,
          armor: 80,
          magicResist: 50,
        },
      ],
      activeTargetId: DEFAULT_TARGET_ID,
      chartType: "bars",
      xMode: "step",
    },
  }

  const edges: FlowEdge[] = [
    {
      id: "edge-champion-combo",
      source: DEFAULT_CHAMPION_NODE_ID,
      sourceHandle: itemSetHandleId(DEFAULT_ITEM_SET_ID),
      target: DEFAULT_COMBO_NODE_ID,
      targetHandle: COMBO_SOURCES_HANDLE,
      type: "flow",
      data: {},
    },
    {
      id: "edge-combo-graph",
      source: DEFAULT_COMBO_NODE_ID,
      sourceHandle: COMBO_OUT_HANDLE,
      target: DEFAULT_GRAPH_NODE_ID,
      targetHandle: GRAPH_COMBOS_HANDLE,
      type: "flow",
      data: {},
    },
  ]

  return { nodes: [championNode, comboNode, graphNode], edges }
}
