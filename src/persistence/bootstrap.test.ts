import { renderHook, waitFor } from "@testing-library/react"
import { beforeEach, describe, expect, it, vi } from "vitest"
import { createDefaultCanvas } from "@/graph/default-canvas"
import { useGraphStore } from "@/graph/store"
import { useBootstrapPersistence } from "./bootstrap"
import { usePersistenceStore } from "./persistence-store"
import { getLastOpenedId, listCanvasSummaries } from "./storage"

/** Resets the graph store back to the default canvas and the persistence
 * store back to its pre-bootstrap shape — mirrors `canvas-actions.test.ts`/
 * `autosave.test.ts`'s `resetStores()`, but deliberately leaves
 * `localStorage` untouched so callers can reuse it to simulate a reload
 * (fresh stores, same disk) as well as a truly cold boot (paired with
 * `localStorage.clear()`). */
function resetStoresForBoot(): void {
  const { nodes, edges } = createDefaultCanvas()
  useGraphStore.getState().loadCanvas(nodes, edges)
  useGraphStore.temporal.getState().clear()
  usePersistenceStore.setState({
    bootstrapped: false,
    active: { id: "", name: "", patch: "", createdAt: "", updatedAt: "" },
    saveStatus: "saved",
    patchPin: { kind: "current" },
  })
}

beforeEach(() => {
  localStorage.clear()
  window.location.hash = ""
  resetStoresForBoot()
})

describe("useBootstrapPersistence", () => {
  it("persists the claimed default canvas immediately, so the drawer lists it instead of showing none saved", async () => {
    const toast = { show: vi.fn() }

    const { unmount } = renderHook(() => useBootstrapPersistence(toast))
    await waitFor(() => expect(usePersistenceStore.getState().bootstrapped).toBe(true))

    const active = usePersistenceStore.getState().active
    expect(active.name).toBe("Tutorial")
    expect(useGraphStore.getState().nodes.some((node) => node.type === "tutorial")).toBe(true)
    // The regression: claimDefaultCanvas used to only call setActive(),
    // never saveCanvas()/setLastOpenedId() — so storage stayed empty.
    expect(listCanvasSummaries()).toHaveLength(1)
    expect(listCanvasSummaries()[0]?.id).toBe(active.id)
    expect(getLastOpenedId()).toBe(active.id)

    unmount()
  })

  it("reopens the same last-opened canvas on a reload instead of claiming a brand new one", async () => {
    const toast = { show: vi.fn() }

    const first = renderHook(() => useBootstrapPersistence(toast))
    await waitFor(() => expect(usePersistenceStore.getState().bootstrapped).toBe(true))
    const firstActiveId = usePersistenceStore.getState().active.id
    first.unmount()

    // Simulate a reload: fresh stores (new hook instance, pre-bootstrap
    // state), but the same `localStorage` a real reload would see.
    resetStoresForBoot()
    const second = renderHook(() => useBootstrapPersistence(toast))
    await waitFor(() => expect(usePersistenceStore.getState().bootstrapped).toBe(true))

    expect(usePersistenceStore.getState().active.id).toBe(firstActiveId)
    expect(listCanvasSummaries()).toHaveLength(1)
    second.unmount()
  })
})
