import { useEffect, useState } from "react"
import { getSnapshot } from "./loader"
import type { Snapshot } from "./schema"

export type SnapshotStatus =
  | { readonly status: "loading" }
  | { readonly status: "ready"; readonly snapshot: Snapshot }
  | { readonly status: "error"; readonly error: Error }

/** Async snapshot load as React state (deliverable 6: "Snapshot loading
 * state (skeleton) and error state"). `getSnapshot()` is itself a memoized
 * singleton promise (`src/data/loader.ts`), so mounting this hook from
 * several components never triggers more than one fetch. */
export function useSnapshot(): SnapshotStatus {
  const [state, setState] = useState<SnapshotStatus>({ status: "loading" })

  useEffect(() => {
    let cancelled = false
    getSnapshot()
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
  }, [])

  return state
}
