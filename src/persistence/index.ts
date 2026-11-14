/**
 * Public API of `src/persistence/` for `src/app/` to consume (plan D14).
 * Internal modules (`document.ts`, `migrations.ts`, `graph-bridge.ts`,
 * `result.ts`) stay import-by-path for anything inside this directory.
 */

export { startAutosave } from "./autosave"
export { useBootstrapPersistence } from "./bootstrap"
export {
  copyShareLink,
  createNewCanvas,
  deleteCanvasWithUndo,
  duplicateCanvas,
  exportActiveCanvasAsJson,
  importCanvasFromJson,
  openSavedCanvas,
  renameCanvas,
} from "./canvas-actions"
export { recalculatePatchPin, type ToastApi } from "./open-canvas"
export type { PatchPinDecision } from "./patch-pin"
export type { ActiveCanvasMeta, SaveStatus } from "./persistence-store"
export { usePersistenceStore } from "./persistence-store"
export type { CanvasDocument } from "./schema"
export { type CanvasSummary, listCanvasSummaries } from "./storage"
export { type EffectiveSnapshotStatus, useEffectiveSnapshot } from "./use-effective-snapshot"
