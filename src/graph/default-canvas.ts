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
 *
 * Layout math (Phase 5 shell-bug fix, see `.qa/phase3-live.png`): nodes
 * were previously positioned with a 0px champion→combo gap (champion's
 * `DEFAULT_WIDTH` of 560 exactly equals the combo's old `x`), so the two
 * visually touched/overlapped, and uneven y values (120/160/100) combined
 * with the Graph node's much taller rendered content (chart + comparison
 * table) skewed `fitView`'s centering. Every node now starts at the same
 * `y` (simple top-aligned left-to-right flow) and `x` offsets are derived
 * from each predecessor's real `DEFAULT_WIDTH` (`ChampionNode.tsx` 560 /
 * `ComboNode.tsx` 380) plus a fixed gap comfortably over the plan's 64px
 * minimum — never hand-tuned pixel guesses that silently drift from the
 * node components' actual widths.
 */

export const DEFAULT_CHAMPION_NODE_ID = "champion-yasuo"
export const DEFAULT_ITEM_SET_ID = "itemset-infinity-edge"
export const DEFAULT_COMBO_NODE_ID = "combo-1"
export const DEFAULT_GRAPH_NODE_ID = "graph-1"
export const DEFAULT_TARGET_ID = "target-1"

const INFINITY_EDGE_ITEM_ID = 3031

/** Mirrors `ChampionNode.tsx`'s/`ComboNode.tsx`'s own `DEFAULT_WIDTH` — kept
 * here (not imported) since `src/nodes/**` is outside this phase's
 * ownership; a width drift there is harmless (still ≥ the 64px minimum
 * gap below, just not pixel-perfect), never a broken/overlapping layout. */
const CHAMPION_NODE_WIDTH = 560
const COMBO_NODE_WIDTH = 480
const NODE_GAP = 80
const ROW_Y = 0

export function createDefaultCanvas(): { readonly nodes: FlowNode[]; readonly edges: FlowEdge[] } {
  const comboX = CHAMPION_NODE_WIDTH + NODE_GAP
  const graphX = comboX + COMBO_NODE_WIDTH + NODE_GAP

  const championNode: ChampionFlowNode = {
    id: DEFAULT_CHAMPION_NODE_ID,
    type: "champion",
    position: { x: 0, y: ROW_Y },
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
    position: { x: comboX, y: ROW_Y },
    data: {
      name: "Combo 1",
      steps: [
        { id: "step-1", sourceId: DEFAULT_CHAMPION_NODE_ID, actionId: "Q" },
        { id: "step-2", sourceId: DEFAULT_CHAMPION_NODE_ID, actionId: "AA" },
        { id: "step-3", sourceId: DEFAULT_CHAMPION_NODE_ID, actionId: "E" },
        { id: "step-4", sourceId: DEFAULT_CHAMPION_NODE_ID, actionId: "Q-empowered" },
      ],
      collapsedSections: [],
    },
  }

  const graphNode: GraphFlowNode = {
    id: DEFAULT_GRAPH_NODE_ID,
    type: "graph",
    position: { x: graphX, y: ROW_Y },
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
      activeTargetIds: [DEFAULT_TARGET_ID],
      chartType: "cumulative",
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
