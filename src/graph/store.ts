import { temporal } from "zundo"
import { create } from "zustand"
import { createChampionSlice } from "./champion-slice"
import { createComboSlice } from "./combo-slice"
import { createDefaultCanvas } from "./default-canvas"
import { createFlowSlice } from "./flow-slice"
import { createGraphSlice } from "./graph-slice"
import { toCanonicalGraph } from "./store-helpers"
import type { CanonicalGraph, GraphState } from "./store-types"

const HISTORY_LIMIT = 100

/** How long a burst of rapid-fire changes (dragging a node, scrubbing a
 * slider) must go quiet before it commits as ONE undo checkpoint (plan
 * D14 deliverable 4: "group continuous slider drags into one history
 * entry"). Long enough to span a drag's ~16ms-apart pointermove ticks;
 * short enough that two deliberate, separate user actions — which
 * naturally space apart via render/network round-trips in an e2e test —
 * still land as two checkpoints. */
const HISTORY_BURST_MS = 400

function canonicalEquals(past: CanonicalGraph, current: CanonicalGraph): boolean {
  return JSON.stringify(past) === JSON.stringify(current)
}

/**
 * Creates a fresh graph store instance (plan §5): canonical user input
 * only — node/edge positions and typing, champion/combo/graph node data.
 * Every derived number (kits, sim results, chart series, comparison rows)
 * lives in `kit-cache.ts`/`sim-cache.ts`/`chart-points.ts`/
 * `comparison-row.ts` instead, computed live from this state.
 *
 * Wrapped in zundo's `temporal` middleware for undo/redo
 * (`store.temporal.getState().undo()`/`.redo()`, wired to the top bar and
 * Ctrl+Z/Ctrl+Shift+Z/Ctrl+Y by `src/app/TopBar.tsx`, plan D14). Three
 * things keep history meaningful instead of a tick-by-tick tape:
 *
 * 1. `partialize` tracks `toCanonicalGraph(nodes, edges)` — the same
 *    projection `src/persistence/` saves/exports/shares — so transient UI
 *    state (`hoveredComboId`, React Flow's `selected`/`dragging`/
 *    `measured`, the Graph hover highlight's `data.highlighted`/`dimmed`
 *    on edges) never becomes an undo step or leaks into a saved doc.
 * 2. `equality` deep-compares that canonical projection (not `===`, which
 *    would always be false since `partialize` allocates a new object
 *    every call) so a pure selection change — which still produces a new
 *    `nodes` array reference via `applyNodeChanges` — is correctly
 *    recognized as "nothing canonical changed" and recorded as nothing.
 * 3. `handleSet` debounces *when* a checkpoint commits, but — verified
 *    against zundo's `_handleSet`/`temporalHandleSet` internals (the
 *    `handleSet` option wraps the final "push to `pastStates`" step, not
 *    the `set()` call itself) — always using the state from *before the
 *    burst started*, not the latest mid-drag tick, otherwise undo would
 *    only step back one pixel instead of to before the whole drag. The
 *    live store state on screen is never delayed; only the bookkeeping
 *    decision of *when/what* to push to history is.
 *
 * Exposed as a factory (rather than only the `useGraphStore` singleton
 * below) so tests get an isolated instance instead of sharing — and
 * mutating — one global store across cases. The burst-commit timer is
 * kept as a variable local to *this* call (not module-level), so two
 * store instances never share one timer.
 */
export function createGraphStore() {
  let pendingBurst:
    | { readonly timeoutId: ReturnType<typeof setTimeout>; readonly burstStart: CanonicalGraph }
    | undefined

  function cancelPendingBurst(): void {
    if (pendingBurst !== undefined) {
      clearTimeout(pendingBurst.timeoutId)
      pendingBurst = undefined
    }
  }

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
          // `src/persistence/`'s one seam into this store (see
          // `PersistenceBridgeSlice`): replaces the canonical graph
          // wholesale for opening a different canvas, import, a decoded
          // share URL, or a patch-pin reconcile. Deliberately contributes
          // NO history entry of its own in either direction — cancelling
          // the pending burst both before *and* after `set` (the `set`
          // call itself schedules a fresh one via `handleSet` below,
          // which this second cancel discards before its timer can ever
          // fire) means a freshly loaded canvas never offers undo back
          // into whatever was open before it. Wiping the *existing*
          // `pastStates`/`futureStates` entirely is the caller's job —
          // see `src/persistence/graph-bridge.ts`, which pairs this with
          // `temporal.getState().clear()`.
          loadCanvas: (newNodes, newEdges) => {
            cancelPendingBurst()
            set({ nodes: newNodes, edges: newEdges })
            cancelPendingBurst()
          },
        }
      },
      {
        partialize: (state) => toCanonicalGraph(state.nodes, state.edges),
        equality: canonicalEquals,
        limit: HISTORY_LIMIT,
        handleSet: (handleSet) => (pastState, replace) => {
          // zundo's own `.d.ts` mistypes `pastState` as the full store's
          // `setState` first-overload parameter — an artifact of
          // `Parameters<>` only resolving one overload of zustand's own
          // overloaded `setState`. At runtime (confirmed against zundo's
          // `temporalHandleSet`, which always calls this with the
          // *partialized* pre-change state) it is always `CanonicalGraph`.
          // The inner `handleSet` is likewise declared as a plain 2-arg
          // `setState` — this store never configures zundo's `onSave`, so
          // dropping the (real but undeclared) `currentState`/`deltaState`
          // arguments `_handleSet` also accepts is a no-op here.
          const tickStart = pastState as unknown as CanonicalGraph
          const burstStart = pendingBurst?.burstStart ?? tickStart
          cancelPendingBurst()
          const timeoutId = setTimeout(() => {
            pendingBurst = undefined
            handleSet(burstStart as unknown as Parameters<typeof handleSet>[0], replace)
          }, HISTORY_BURST_MS)
          pendingBurst = { timeoutId, burstStart }
        },
      },
    ),
  )
}

export const useGraphStore = createGraphStore()
