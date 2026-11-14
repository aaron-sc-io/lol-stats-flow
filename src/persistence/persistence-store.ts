import { create } from "zustand"
import type { PatchPinDecision } from "./patch-pin"

/**
 * Session state for "which canvas is open and how is it doing" — kept
 * deliberately separate from the graph store (`@/graph/store`), which
 * stays canonical-user-input-only. Nothing here is undo-tracked or part
 * of a saved document; it's UI/session bookkeeping the top bar, drawer,
 * and patch-pin banner read from.
 */

export type SaveStatus = "saved" | "saving" | "error"

export type ActiveCanvasMeta = {
  readonly id: string
  readonly name: string
  readonly patch: string
  readonly createdAt: string
  readonly updatedAt: string
}

const PLACEHOLDER_ACTIVE: ActiveCanvasMeta = {
  id: "",
  name: "",
  patch: "",
  createdAt: "",
  updatedAt: "",
}

type PersistenceState = {
  /** False until `src/persistence/bootstrap.ts`'s boot sequence (share
   * URL -> last-opened -> default canvas) has resolved once. The app
   * shell holds off rendering canvas-dependent chrome (the editable name,
   * the patch-pin banner) until this flips true, the same way it already
   * gates on `useSnapshot()`'s "loading" status. */
  readonly bootstrapped: boolean
  readonly active: ActiveCanvasMeta
  readonly saveStatus: SaveStatus
  readonly patchPin: PatchPinDecision
  readonly setActive: (meta: ActiveCanvasMeta) => void
  readonly renameActive: (name: string) => void
  readonly setSaveStatus: (status: SaveStatus) => void
  readonly setPatchPin: (decision: PatchPinDecision) => void
  readonly markBootstrapped: () => void
}

export const usePersistenceStore = create<PersistenceState>((set) => ({
  bootstrapped: false,
  active: PLACEHOLDER_ACTIVE,
  saveStatus: "saved",
  patchPin: { kind: "current" },
  setActive: (meta) => set({ active: meta }),
  renameActive: (name) => set((state) => ({ active: { ...state.active, name } })),
  setSaveStatus: (status) => set({ saveStatus: status }),
  setPatchPin: (decision) => set({ patchPin: decision }),
  markBootstrapped: () => set({ bootstrapped: true }),
}))
