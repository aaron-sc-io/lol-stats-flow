import { useGraphStore } from "@/graph/store"
import { toCanonicalGraph } from "@/graph/store-helpers"
import type { FlowEdge, FlowNode } from "@/graph/types"
import { buildCanvasDocument } from "./document"
import type { ToastApi } from "./open-canvas"
import { usePersistenceStore } from "./persistence-store"
import { saveCanvas, setLastOpenedId } from "./storage"

const AUTOSAVE_DEBOUNCE_MS = 500

function canonicalKey(state: {
  readonly nodes: readonly FlowNode[]
  readonly edges: readonly FlowEdge[]
}): string {
  return JSON.stringify(toCanonicalGraph(state.nodes, state.edges))
}

/**
 * Debounced autosave (plan D14 deliverable 1: "~500ms on store change,
 * plus on beforeunload"). Subscribes to the graph store directly (not a
 * React effect depending on `nodes`/`edges`, which would re-subscribe on
 * every render) and compares the *canonical* projection — the same one
 * `store.ts`'s undo history and every saved document use — so a pure
 * selection/hover change (which still produces a new `nodes` array
 * reference) never flickers the save-status indicator or writes to disk.
 *
 * Call once, with the toast API, from the app shell; call the returned
 * cleanup on unmount (tests do this explicitly; the live app effectively
 * never unmounts this).
 */
export function startAutosave(toast: ToastApi): () => void {
  let timer: ReturnType<typeof setTimeout> | undefined
  let lastKey = canonicalKey(useGraphStore.getState())

  function flush(): void {
    clearTimeout(timer)
    timer = undefined
    const active = usePersistenceStore.getState()
    if (!active.bootstrapped) {
      return
    }
    const { nodes, edges } = useGraphStore.getState()
    const doc = buildCanvasDocument(
      { ...active.active, updatedAt: new Date().toISOString() },
      nodes,
      edges,
    )
    const result = saveCanvas(doc)
    if (result.ok) {
      usePersistenceStore.getState().setActive(doc)
      setLastOpenedId(doc.id)
      usePersistenceStore.getState().setSaveStatus("saved")
    } else {
      usePersistenceStore.getState().setSaveStatus("error")
      toast.show({ message: result.error.message })
    }
  }

  function scheduleSave(): void {
    usePersistenceStore.getState().setSaveStatus("saving")
    clearTimeout(timer)
    timer = setTimeout(flush, AUTOSAVE_DEBOUNCE_MS)
  }

  const unsubscribe = useGraphStore.subscribe((state) => {
    const key = canonicalKey(state)
    if (key === lastKey) {
      return
    }
    lastKey = key
    scheduleSave()
  })

  function handleBeforeUnload(): void {
    if (timer !== undefined) {
      flush()
    }
  }
  window.addEventListener("beforeunload", handleBeforeUnload)

  return () => {
    clearTimeout(timer)
    unsubscribe()
    window.removeEventListener("beforeunload", handleBeforeUnload)
  }
}
