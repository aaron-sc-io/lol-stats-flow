import { beforeEach, describe, expect, it, vi } from "vitest"
import { createDefaultCanvas } from "@/graph/default-canvas"
import { useGraphStore } from "@/graph/store"
import {
  copyShareLink,
  createNewCanvas,
  deleteCanvasWithUndo,
  duplicateCanvas,
  importCanvasFromJson,
  renameCanvas,
} from "./canvas-actions"
import { buildCanvasDocument } from "./document"
import { usePersistenceStore } from "./persistence-store"
import { getLastOpenedId, listCanvasSummaries, loadCanvas, saveCanvas } from "./storage"

const CURRENT_PATCH = "16.22.1"

function resetStores() {
  const { nodes, edges } = createDefaultCanvas()
  useGraphStore.getState().loadCanvas(nodes, edges)
  useGraphStore.temporal.getState().clear()
  usePersistenceStore.setState({
    bootstrapped: true,
    active: {
      id: "seed-canvas",
      name: "Seed",
      patch: CURRENT_PATCH,
      createdAt: "2026-11-14T00:00:00.000Z",
      updatedAt: "2026-11-14T00:00:00.000Z",
    },
    saveStatus: "saved",
    patchPin: { kind: "current" },
  })
}

beforeEach(() => {
  localStorage.clear()
  resetStores()
})

describe("createNewCanvas", () => {
  it("replaces the graph, saves it, and marks it last-opened", async () => {
    await createNewCanvas()

    const active = usePersistenceStore.getState().active
    expect(active.name).toBe("Untitled canvas")
    expect(loadCanvas(active.id, CURRENT_PATCH).ok).toBe(true)
    expect(getLastOpenedId()).toBe(active.id)
  })
})

describe("duplicateCanvas", () => {
  it("creates a saved copy with a new id, suffixed name, and the same graph", async () => {
    const { nodes, edges } = createDefaultCanvas()
    const original = buildCanvasDocument(
      { id: "orig-1", name: "Original", patch: CURRENT_PATCH, createdAt: "x", updatedAt: "x" },
      nodes,
      edges,
    )
    saveCanvas(original)

    await duplicateCanvas("orig-1", { show: vi.fn() })

    const summaries = listCanvasSummaries()
    const copy = summaries.find((s) => s.id !== "orig-1")
    expect(copy?.name).toBe("Original (copy)")
    expect(summaries).toHaveLength(2)
  })
})

describe("renameCanvas", () => {
  it("updates the stored name and the active meta when it's the open canvas", async () => {
    const { nodes, edges } = createDefaultCanvas()
    const doc = buildCanvasDocument(
      { id: "seed-canvas", name: "Old name", patch: CURRENT_PATCH, createdAt: "x", updatedAt: "x" },
      nodes,
      edges,
    )
    saveCanvas(doc)

    await renameCanvas("seed-canvas", "New name")

    const reloaded = loadCanvas("seed-canvas", CURRENT_PATCH)
    expect(reloaded.ok && reloaded.value.name).toBe("New name")
    expect(usePersistenceStore.getState().active.name).toBe("New name")
  })
})

describe("deleteCanvasWithUndo", () => {
  it("deletes the canvas, and Undo restores it", async () => {
    const { nodes, edges } = createDefaultCanvas()
    const doc = buildCanvasDocument(
      { id: "to-delete", name: "Doomed", patch: CURRENT_PATCH, createdAt: "x", updatedAt: "x" },
      nodes,
      edges,
    )
    saveCanvas(doc)
    const toast = { show: vi.fn() }

    await deleteCanvasWithUndo("to-delete", toast)

    expect(loadCanvas("to-delete", CURRENT_PATCH).ok).toBe(false)
    expect(toast.show).toHaveBeenCalledWith(
      expect.objectContaining({ actionLabel: "Undo", onAction: expect.any(Function) }),
    )

    const onAction = toast.show.mock.calls[0]?.[0]?.onAction as () => void
    onAction()
    expect(loadCanvas("to-delete", CURRENT_PATCH).ok).toBe(true)
  })

  it("falls back to a fresh default canvas when deleting the currently-active one", async () => {
    const { nodes, edges } = createDefaultCanvas()
    saveCanvas(
      buildCanvasDocument(
        { id: "seed-canvas", name: "Seed", patch: CURRENT_PATCH, createdAt: "x", updatedAt: "x" },
        nodes,
        edges,
      ),
    )

    await deleteCanvasWithUndo("seed-canvas", { show: vi.fn() })

    expect(usePersistenceStore.getState().active.id).not.toBe("seed-canvas")
    expect(usePersistenceStore.getState().active.name).toBe("Untitled canvas")
  })
})

describe("importCanvasFromJson", () => {
  it("imports a valid exported document as a brand-new canvas", async () => {
    const { nodes, edges } = createDefaultCanvas()
    const doc = buildCanvasDocument(
      { id: "export-1", name: "Exported", patch: CURRENT_PATCH, createdAt: "x", updatedAt: "x" },
      nodes,
      edges,
    )
    const toast = { show: vi.fn() }

    await importCanvasFromJson(JSON.stringify(doc), toast)

    expect(toast.show).not.toHaveBeenCalled()
    expect(usePersistenceStore.getState().active.name).toBe("Exported")
    expect(usePersistenceStore.getState().active.id).not.toBe("export-1")
  })

  it("rejects invalid JSON with a toast instead of throwing", async () => {
    const toast = { show: vi.fn() }

    await importCanvasFromJson("{not json", toast)

    expect(toast.show).toHaveBeenCalledWith(expect.objectContaining({ tone: "error" }))
  })

  it("rejects well-formed JSON that isn't a canvas document", async () => {
    const toast = { show: vi.fn() }

    await importCanvasFromJson(JSON.stringify({ hello: "world" }), toast)

    expect(toast.show).toHaveBeenCalledWith(expect.objectContaining({ tone: "error" }))
  })
})

describe("copyShareLink", () => {
  it("encodes the currently open graph into a share URL", () => {
    const url = copyShareLink()

    expect(url).toContain("#c=")
  })
})
