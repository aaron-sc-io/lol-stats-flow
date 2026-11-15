import { beforeEach, describe, expect, it, vi } from "vitest"
import { createDefaultCanvas, DEFAULT_CHAMPION_NODE_ID } from "@/graph/default-canvas"
import { useGraphStore } from "@/graph/store"
import { startAutosave } from "./autosave"
import { usePersistenceStore } from "./persistence-store"
import { loadCanvas } from "./storage"

const CURRENT_PATCH = "16.22.1"
const ACTIVE_ID = "autosave-test-canvas"

function resetStores() {
  const { nodes, edges } = createDefaultCanvas()
  useGraphStore.getState().loadCanvas(nodes, edges)
  useGraphStore.temporal.getState().clear()
  usePersistenceStore.setState({
    bootstrapped: true,
    active: {
      id: ACTIVE_ID,
      name: "Autosave test",
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

describe("startAutosave", () => {
  it("saves a real canonical change ~500ms after it happens", () => {
    vi.useFakeTimers()
    const toast = { show: vi.fn() }
    const stop = startAutosave(toast)

    useGraphStore.getState().setChampionLevel(DEFAULT_CHAMPION_NODE_ID, 3)
    expect(usePersistenceStore.getState().saveStatus).toBe("saving")

    vi.advanceTimersByTime(600)

    expect(usePersistenceStore.getState().saveStatus).toBe("saved")
    const saved = loadCanvas(ACTIVE_ID, CURRENT_PATCH)
    expect(saved.ok).toBe(true)
    if (saved.ok) {
      const champion = saved.value.graph.nodes.find((n) => n.id === DEFAULT_CHAMPION_NODE_ID)
      expect(champion?.type === "champion" && champion.data.level).toBe(3)
    }

    stop()
    vi.useRealTimers()
  })

  it("does not save a pure selection change (transient, not canonical)", () => {
    vi.useFakeTimers()
    const toast = { show: vi.fn() }
    const stop = startAutosave(toast)

    useGraphStore
      .getState()
      .onNodesChange([{ id: DEFAULT_CHAMPION_NODE_ID, type: "select", selected: true }])
    vi.advanceTimersByTime(600)

    expect(usePersistenceStore.getState().saveStatus).toBe("saved")
    expect(loadCanvas(ACTIVE_ID, CURRENT_PATCH).ok).toBe(false)

    stop()
    vi.useRealTimers()
  })

  it("flushes a pending save immediately on beforeunload instead of waiting out the debounce", () => {
    const toast = { show: vi.fn() }
    const stop = startAutosave(toast)

    useGraphStore.getState().setChampionLevel(DEFAULT_CHAMPION_NODE_ID, 7)
    window.dispatchEvent(new Event("beforeunload"))

    expect(usePersistenceStore.getState().saveStatus).toBe("saved")
    const saved = loadCanvas(ACTIVE_ID, CURRENT_PATCH)
    expect(saved.ok).toBe(true)
    if (saved.ok) {
      const champion = saved.value.graph.nodes.find((n) => n.id === DEFAULT_CHAMPION_NODE_ID)
      expect(champion?.type === "champion" && champion.data.level).toBe(7)
    }

    stop()
  })

  it("reports a save error via the toast instead of crashing when storage fails", () => {
    vi.useFakeTimers()
    const spy = vi.spyOn(Storage.prototype, "setItem").mockImplementation(() => {
      throw new DOMException("quota exceeded", "QuotaExceededError")
    })
    const toast = { show: vi.fn() }
    const stop = startAutosave(toast)

    useGraphStore.getState().setChampionLevel(DEFAULT_CHAMPION_NODE_ID, 9)
    vi.advanceTimersByTime(600)

    expect(usePersistenceStore.getState().saveStatus).toBe("error")
    expect(toast.show).toHaveBeenCalledWith(expect.objectContaining({ tone: "error" }))

    stop()
    spy.mockRestore()
    vi.useRealTimers()
  })
})
