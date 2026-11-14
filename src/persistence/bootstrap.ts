import { useEffect, useRef } from "react"
import { getCurrentPatchString } from "@/data/loader"
import { generateId } from "@/graph/store-helpers"
import { openCanvasDocument, type ToastApi } from "./open-canvas"
import { usePersistenceStore } from "./persistence-store"
import { decodeShareHash } from "./share-url"
import { getLastOpenedId, loadCanvas } from "./storage"

function clearShareHash(): void {
  history.replaceState(null, "", window.location.pathname + window.location.search)
}

/**
 * Runs once on app mount (plan D14 deliverable 1 — "last-opened canvas
 * restored on load", "share URL decoded on load"): a strict fallback
 * chain, each step only reached if the previous one didn't already claim
 * an active canvas and return.
 *
 * 1. `location.hash` starting with `#c=` → decode it into a *new* unsaved
 *    canvas (invalid/corrupted payload → toast, fall through).
 * 2. The last-opened saved canvas, if its id is on disk and loads/
 *    migrates cleanly (missing/corrupt → fall through).
 * 3. The default canvas `src/graph/store.ts` already booted with —
 *    nothing to load, just claim it as the active document.
 *
 * The `hasRun` ref (same one-shot-effect pattern `App.tsx`'s
 * `FlowCanvas` already uses for its initial `fitView`) guards against
 * React re-invoking the effect — `toast`'s identity changes on every
 * `ToastProvider` render, so it can't be the thing preventing a re-run.
 */
export function useBootstrapPersistence(toast: ToastApi): void {
  const hasRun = useRef(false)

  useEffect(() => {
    if (hasRun.current) {
      return
    }
    hasRun.current = true

    async function claimDefaultCanvas(): Promise<void> {
      const currentPatch = await getCurrentPatchString()
      const now = new Date().toISOString()
      usePersistenceStore.getState().setActive({
        id: generateId("canvas"),
        name: "Untitled canvas",
        patch: currentPatch,
        createdAt: now,
        updatedAt: now,
      })
      usePersistenceStore.getState().setPatchPin({ kind: "current" })
    }

    async function boot(): Promise<void> {
      const hash = window.location.hash
      if (hash.startsWith("#c=")) {
        const currentPatch = await getCurrentPatchString()
        const decoded = decodeShareHash(hash, currentPatch)
        clearShareHash()
        if (decoded.ok) {
          await openCanvasDocument(decoded.value, { toast, persistLastOpened: false })
          usePersistenceStore.getState().markBootstrapped()
          return
        }
        toast.show({
          message:
            "That share link is invalid or has been corrupted — showing your last canvas instead.",
        })
      }

      const lastOpenedId = getLastOpenedId()
      if (lastOpenedId !== null) {
        const currentPatch = await getCurrentPatchString()
        const restored = loadCanvas(lastOpenedId, currentPatch)
        if (restored.ok) {
          await openCanvasDocument(restored.value, { toast, persistLastOpened: true })
          usePersistenceStore.getState().markBootstrapped()
          return
        }
      }

      await claimDefaultCanvas()
      usePersistenceStore.getState().markBootstrapped()
    }

    void boot()
  }, [toast])
}
