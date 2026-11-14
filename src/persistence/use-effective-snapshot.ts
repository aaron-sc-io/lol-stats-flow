import { useEffect, useState } from "react"
import { getSnapshot, getSnapshotForPatch } from "@/data/loader"
import type { Snapshot } from "@/data/schema"

export type EffectiveSnapshotStatus =
  | { readonly status: "loading" }
  | { readonly status: "ready"; readonly snapshot: Snapshot }
  | { readonly status: "error"; readonly error: Error }

/**
 * Same shape/contract as `@/data/use-snapshot`'s `useSnapshot`, but able
 * to load a *specific* patch's snapshot instead of always "whatever is
 * current" — the one extra thing per-canvas patch pin (plan D14
 * deliverable 2) needs: when a canvas is pinned to an older, still-
 * shipped patch, the whole canvas (every champion/item lookup included)
 * must render against *that* snapshot until the user explicitly
 * recalculates. `pinnedPatch: null` behaves exactly like `useSnapshot()`.
 */
export function useEffectiveSnapshot(pinnedPatch: string | null): EffectiveSnapshotStatus {
  const [state, setState] = useState<EffectiveSnapshotStatus>({ status: "loading" })

  useEffect(() => {
    let cancelled = false
    setState({ status: "loading" })
    const promise = pinnedPatch === null ? getSnapshot() : getSnapshotForPatch(pinnedPatch)
    promise
      .then((snapshot) => {
        if (!cancelled) {
          setState({ status: "ready", snapshot })
        }
      })
      .catch((error: unknown) => {
        if (!cancelled) {
          setState({
            status: "error",
            error: error instanceof Error ? error : new Error(String(error)),
          })
        }
      })
    return () => {
      cancelled = true
    }
  }, [pinnedPatch])

  return state
}
