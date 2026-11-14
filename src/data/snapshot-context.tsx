import { createContext, type ReactNode, useContext } from "react"
import type { Snapshot } from "./schema"

const SnapshotContext = createContext<Snapshot | null>(null)

/** Mounted once, above the canvas, only after `useSnapshot()` resolves to
 * `"ready"` (see `App.tsx`) — every node component reads the snapshot via
 * `useSnapshotContext()` instead of threading it through node `data`,
 * which would pollute the store's canonical-user-input-only contract. */
export function SnapshotProvider({
  snapshot,
  children,
}: {
  readonly snapshot: Snapshot
  readonly children: ReactNode
}) {
  return <SnapshotContext.Provider value={snapshot}>{children}</SnapshotContext.Provider>
}

export function useSnapshotContext(): Snapshot {
  const snapshot = useContext(SnapshotContext)
  if (snapshot === null) {
    throw new Error(
      "useSnapshotContext must be used within a <SnapshotProvider> (mount it once the snapshot is ready)",
    )
  }
  return snapshot
}
