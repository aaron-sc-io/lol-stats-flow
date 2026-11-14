import { temporal } from "zundo"
import { create } from "zustand"
import { createChampionSlice } from "./champion-slice"
import { createComboSlice } from "./combo-slice"
import { createDefaultCanvas } from "./default-canvas"
import { createFlowSlice } from "./flow-slice"
import { createGraphSlice } from "./graph-slice"
import type { GraphState } from "./store-types"

const HISTORY_LIMIT = 100

/**
 * Creates a fresh graph store instance (plan §5): canonical user input
 * only — node/edge positions and typing, champion/combo/graph node data.
 * Every derived number (kits, sim results, chart series, comparison rows)
 * lives in `kit-cache.ts`/`sim-cache.ts`/`chart-points.ts`/
 * `comparison-row.ts` instead, computed live from this state.
 *
 * Wrapped in zundo's `temporal` middleware so undo/redo history already
 * works (`store.temporal.getState().undo()`/`.redo()`) — wiring it to UI
 * (Ctrl+Z, a toolbar button) is Phase 5 (plan D14), not this phase.
 * `partialize` tracks only `nodes`/`edges`: `hoveredComboId` is transient
 * hover UI state, not user input, and must never be undo-able.
 *
 * Exposed as a factory (rather than only the `useGraphStore` singleton
 * below) so tests get an isolated instance instead of sharing — and
 * mutating — one global store across cases.
 */
export function createGraphStore() {
  return create<GraphState>()(
    temporal(
      (set, get) => {
        const { nodes, edges } = createDefaultCanvas()
        return {
          ...createFlowSlice(set, get),
          nodes,
          edges,
          ...createChampionSlice(set),
          ...createComboSlice(set),
          ...createGraphSlice(set),
        }
      },
      {
        partialize: (state) => ({ nodes: state.nodes, edges: state.edges }),
        equality: (past, current) => past.nodes === current.nodes && past.edges === current.edges,
        limit: HISTORY_LIMIT,
      },
    ),
  )
}

export const useGraphStore = createGraphStore()
