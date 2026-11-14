import { useGraphStore } from "@/graph/store"
import type { FlowEdge, FlowNode } from "@/graph/types"

/** The one place `src/persistence/` reaches into the graph store to
 * replace the canvas wholesale — opening a different canvas, import, a
 * decoded share URL, or a patch-pin reconcile. Pairs `loadCanvas` (which
 * itself contributes no history entry either direction, see `store.ts`)
 * with wiping whatever history the *previous* canvas had accumulated —
 * otherwise Ctrl+Z on a freshly opened canvas could step back into the
 * canvas that was open before it. */
export function replaceActiveCanvas(nodes: FlowNode[], edges: FlowEdge[]): void {
  useGraphStore.getState().loadCanvas(nodes, edges)
  useGraphStore.temporal.getState().clear()
}
