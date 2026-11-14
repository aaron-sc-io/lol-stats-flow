import type { ToastOptions } from "@/components/Toast"
import {
  getCurrentPatchString,
  getSnapshot,
  getSnapshotForPatch,
  listAvailablePatches,
} from "@/data/loader"
import type { Snapshot } from "@/data/schema"
import type { FlowEdge, FlowNode } from "@/graph/types"
import { buildCanvasDocument, toFlowGraph } from "./document"
import { replaceActiveCanvas } from "./graph-bridge"
import { decidePatchPin, reconcileCanvasWithSnapshot } from "./patch-pin"
import { usePersistenceStore } from "./persistence-store"
import type { CanvasDocument } from "./schema"
import { saveCanvas, setLastOpenedId } from "./storage"

/** The one shape every "make this canvas the active one" entry point
 * needs: `src/persistence/bootstrap.ts` (restoring last-opened, decoding
 * a share URL), the drawer's "open"/import actions, and the patch-pin
 * banner's "Recalculate" button. Kept as a single object parameter (not
 * 5+ positional args) per the four-plus-parameters rule. */
export type ToastApi = { readonly show: (options: ToastOptions) => void }

type OpenCanvasOptions = {
  readonly toast: ToastApi
  /** Whether a successful open should become "last opened" (persisted,
   * restored on the next reload). `false` for a share-URL decode or a
   * freshly-created, not-yet-saved canvas — becoming "last opened"
   * happens the first time autosave actually persists it instead. */
  readonly persistLastOpened: boolean
}

function describeRemoved(removedLabels: readonly string[]): string {
  const shown = removedLabels.slice(0, 3).join(", ")
  const remaining = removedLabels.length > 3 ? `, and ${removedLabels.length - 3} more` : ""
  return ` Removed: ${shown}${remaining}.`
}

/** Reconciles `nodes` against the current snapshot, commits the result as
 * the active canvas (replacing the graph store, updating session meta,
 * clearing the patch-pin banner), persists it, and toasts a notice if
 * anything was emptied. Shared by `openCanvasDocument`'s "migrate" branch
 * (the pinned snapshot is already gone) and `recalculatePatchPin` (the
 * user opted in from the banner while the pinned snapshot was still
 * available, so it's used to name anything removed). */
async function reconcileAndCommit(params: {
  readonly id: string
  readonly name: string
  readonly createdAt: string
  readonly fromPatch: string
  readonly nodes: readonly FlowNode[]
  readonly edges: readonly FlowEdge[]
  readonly lookupSnapshot: Snapshot | null
  readonly toast: ToastApi
  readonly persistLastOpened: boolean
}): Promise<void> {
  const currentPatch = await getCurrentPatchString()
  const newSnapshot = await getSnapshot()
  const { nodes, removedLabels } = reconcileCanvasWithSnapshot(
    params.nodes,
    newSnapshot,
    params.lookupSnapshot,
  )
  const finalDoc = buildCanvasDocument(
    {
      id: params.id,
      name: params.name,
      patch: currentPatch,
      createdAt: params.createdAt,
      updatedAt: new Date().toISOString(),
    },
    nodes,
    params.edges,
  )

  const finalFlowGraph = toFlowGraph(finalDoc.graph)
  replaceActiveCanvas(finalFlowGraph.nodes, finalFlowGraph.edges)
  usePersistenceStore.getState().setActive(finalDoc)
  usePersistenceStore.getState().setPatchPin({ kind: "current" })

  saveCanvas(finalDoc)
  if (params.persistLastOpened) {
    setLastOpenedId(finalDoc.id)
  }

  const base = `Built on patch ${params.fromPatch}, which is no longer available — moved to ${currentPatch}.`
  params.toast.show({
    message: removedLabels.length > 0 ? `${base}${describeRemoved(removedLabels)}` : base,
  })
}

/** Makes `doc` the active canvas: decides what its patch pin means right
 * now and either renders it as-is (current patch, or a still-shipped
 * pinned patch — the banner handles the latter), or — if its pinned
 * snapshot has been pruned — reconciles it onto the current patch
 * immediately, with a toast notice (plan D14 deliverable 2). */
export async function openCanvasDocument(
  doc: CanvasDocument,
  options: OpenCanvasOptions,
): Promise<void> {
  const currentPatch = await getCurrentPatchString()
  const availablePatches = listAvailablePatches()
  const decision = decidePatchPin(doc.patch, currentPatch, availablePatches)
  const { nodes, edges } = toFlowGraph(doc.graph)

  if (decision.kind === "migrate") {
    await reconcileAndCommit({
      id: doc.id,
      name: doc.name,
      createdAt: doc.createdAt,
      fromPatch: doc.patch,
      nodes,
      edges,
      lookupSnapshot: null,
      toast: options.toast,
      persistLastOpened: options.persistLastOpened,
    })
    return
  }

  replaceActiveCanvas(nodes, edges)
  usePersistenceStore.getState().setActive({
    id: doc.id,
    name: doc.name,
    patch: doc.patch,
    createdAt: doc.createdAt,
    updatedAt: doc.updatedAt,
  })
  usePersistenceStore.getState().setPatchPin(decision)
  if (options.persistLastOpened) {
    setLastOpenedId(doc.id)
  }
}

/** The patch-pin banner's "Recalculate" action: moves the *currently
 * open* canvas from its pinned patch onto the current one, using the
 * pinned snapshot (still available — that's the only way this banner
 * shows at all) to name anything that gets emptied. */
export async function recalculatePatchPin(
  active: { readonly id: string; readonly name: string; readonly createdAt: string },
  pinnedPatch: string,
  nodes: readonly FlowNode[],
  edges: readonly FlowEdge[],
  toast: ToastApi,
): Promise<void> {
  const lookupSnapshot = await getSnapshotForPatch(pinnedPatch)
  await reconcileAndCommit({
    id: active.id,
    name: active.name,
    createdAt: active.createdAt,
    fromPatch: pinnedPatch,
    nodes,
    edges,
    lookupSnapshot,
    toast,
    persistLastOpened: true,
  })
}
