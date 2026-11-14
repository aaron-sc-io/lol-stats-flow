import { getCurrentPatchString } from "@/data/loader"
import { createDefaultCanvas } from "@/graph/default-canvas"
import { useGraphStore } from "@/graph/store"
import { generateId } from "@/graph/store-helpers"
import { buildCanvasDocument, toFlowGraph } from "./document"
import { replaceActiveCanvas } from "./graph-bridge"
import { migrateToLatest } from "./migrations"
import { openCanvasDocument, type ToastApi } from "./open-canvas"
import { usePersistenceStore } from "./persistence-store"
import { encodeShareUrl } from "./share-url"
import { deleteCanvas, loadCanvas, saveCanvas, setLastOpenedId } from "./storage"

/**
 * The drawer's verbs (plan D14 deliverable 3): new/open/duplicate/rename/
 * delete-with-undo, JSON export/import, copy share link. Kept out of
 * `Drawer.tsx` itself so the component stays presentational — every
 * function here is independently callable (and was exercised, end to
 * end, by `tests/e2e/persistence.spec.ts`) without mounting any UI.
 */

export async function createNewCanvas(): Promise<void> {
  const currentPatch = await getCurrentPatchString()
  const now = new Date().toISOString()
  const { nodes, edges } = createDefaultCanvas()
  const doc = buildCanvasDocument(
    {
      id: generateId("canvas"),
      name: "Untitled canvas",
      patch: currentPatch,
      createdAt: now,
      updatedAt: now,
    },
    nodes,
    edges,
  )
  replaceActiveCanvas(nodes, edges)
  usePersistenceStore.getState().setActive(doc)
  usePersistenceStore.getState().setPatchPin({ kind: "current" })
  saveCanvas(doc)
  setLastOpenedId(doc.id)
}

export async function openSavedCanvas(id: string, toast: ToastApi): Promise<void> {
  const currentPatch = await getCurrentPatchString()
  const result = loadCanvas(id, currentPatch)
  if (!result.ok) {
    toast.show({ message: "That canvas could not be opened — it may have been deleted." })
    return
  }
  await openCanvasDocument(result.value, { toast, persistLastOpened: true })
}

export async function duplicateCanvas(id: string, toast: ToastApi): Promise<void> {
  const currentPatch = await getCurrentPatchString()
  const result = loadCanvas(id, currentPatch)
  if (!result.ok) {
    toast.show({ message: "That canvas could not be duplicated — it may have been deleted." })
    return
  }
  const now = new Date().toISOString()
  const { nodes, edges } = toFlowGraph(result.value.graph)
  const copy = buildCanvasDocument(
    {
      id: generateId("canvas"),
      name: `${result.value.name} (copy)`,
      patch: result.value.patch,
      createdAt: now,
      updatedAt: now,
    },
    nodes,
    edges,
  )
  saveCanvas(copy)
}

/** Renames a saved canvas by id — any row in the drawer, not necessarily
 * the currently-open one. Keeps the top bar's name field in sync when it
 * does happen to be the active canvas, so an inline rename and the
 * editable-name field never show two different names for the same
 * canvas.
 *
 * The active canvas is not always on disk yet — `claimDefaultCanvas()`
 * (`bootstrap.ts`) sets it as active without saving it, so a rename
 * before the first autosave tick would otherwise find nothing to load
 * and silently drop the name. For that one case, build the document
 * fresh from the live graph store instead of bailing out. */
export async function renameCanvas(id: string, name: string): Promise<void> {
  const currentPatch = await getCurrentPatchString()
  const result = loadCanvas(id, currentPatch)
  const isActive = usePersistenceStore.getState().active.id === id

  if (result.ok) {
    const renamed = { ...result.value, name, updatedAt: new Date().toISOString() }
    saveCanvas(renamed)
    if (isActive) {
      usePersistenceStore.getState().setActive(renamed)
    }
    return
  }

  if (!isActive) {
    return
  }
  const active = usePersistenceStore.getState().active
  const { nodes, edges } = useGraphStore.getState()
  const doc = buildCanvasDocument(
    { ...active, name, updatedAt: new Date().toISOString() },
    nodes,
    edges,
  )
  saveCanvas(doc)
  usePersistenceStore.getState().setActive(doc)
  setLastOpenedId(doc.id)
}

/** Deletes a saved canvas with an Undo toast (DESIGN.md §1.6: destructive
 * actions are undoable, never modal-confirmed). Deleting the currently
 * active canvas falls back to a fresh default one, since the UI can't be
 * left pointed at a canvas no longer on disk. */
export async function deleteCanvasWithUndo(id: string, toast: ToastApi): Promise<void> {
  const currentPatch = await getCurrentPatchString()
  const existing = loadCanvas(id, currentPatch)
  deleteCanvas(id)
  if (usePersistenceStore.getState().active.id === id) {
    await createNewCanvas()
  }
  if (existing.ok) {
    toast.show({
      message: `Deleted "${existing.value.name}".`,
      actionLabel: "Undo",
      onAction: () => {
        saveCanvas(existing.value)
      },
    })
  }
}

function sanitizeFileName(name: string): string {
  return (
    name
      .trim()
      .replace(/[^a-z0-9-_]+/gi, "-")
      .replace(/^-+|-+$/g, "") || "canvas"
  )
}

export function exportActiveCanvasAsJson(): void {
  const active = usePersistenceStore.getState().active
  const { nodes, edges } = useGraphStore.getState()
  const doc = buildCanvasDocument(active, nodes, edges)
  const blob = new Blob([JSON.stringify(doc, null, 2)], { type: "application/json" })
  const url = URL.createObjectURL(blob)
  const link = document.createElement("a")
  link.href = url
  link.download = `${sanitizeFileName(active.name)}.json`
  link.click()
  URL.revokeObjectURL(url)
}

export async function importCanvasFromJson(fileText: string, toast: ToastApi): Promise<void> {
  let parsed: unknown
  try {
    parsed = JSON.parse(fileText)
  } catch {
    toast.show({ message: "That file isn't valid JSON and could not be imported." })
    return
  }

  const currentPatch = await getCurrentPatchString()
  const migrated = migrateToLatest(parsed, currentPatch)
  if (!migrated.ok) {
    toast.show({
      message: "That file isn't a valid lol-stats-flow canvas and could not be imported.",
    })
    return
  }

  const now = new Date().toISOString()
  const imported = { ...migrated.value, id: generateId("canvas"), createdAt: now, updatedAt: now }
  saveCanvas(imported)
  await openCanvasDocument(imported, { toast, persistLastOpened: true })
}

/** Builds a share URL for the canvas currently open in the editor — not
 * necessarily the last *saved* state, so a link copied mid-edit still
 * shares exactly what's on screen. */
export function copyShareLink(): string {
  const active = usePersistenceStore.getState().active
  const { nodes, edges } = useGraphStore.getState()
  const doc = buildCanvasDocument(active, nodes, edges)
  return encodeShareUrl(doc, window.location.href)
}
