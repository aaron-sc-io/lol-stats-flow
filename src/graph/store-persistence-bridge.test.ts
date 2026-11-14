import { afterEach, describe, expect, it, vi } from "vitest"
import { DEFAULT_CHAMPION_NODE_ID } from "./default-canvas"
import { createGraphStore } from "./store"

/**
 * `loadCanvas` (the one seam `src/persistence/` uses to replace the whole
 * canvas) and the history-shaping behavior layered onto zundo in
 * `store.ts`: transient UI state excluded from undo, and a burst of rapid
 * changes — a node drag, a slider scrub — collapsing into one checkpoint
 * instead of one per tick (plan D14 deliverable 4). `store.test.ts` covers
 * the original CRUD actions; this file is scoped to what Phase 5 added.
 */

function freshStore() {
  return createGraphStore()
}

afterEach(() => {
  vi.useRealTimers()
})

describe("graph store — loadCanvas", () => {
  it("replaces nodes and edges wholesale", () => {
    const store = freshStore()
    const nextNodes = [
      {
        id: "champion-fresh",
        type: "champion" as const,
        position: { x: 0, y: 0 },
        data: { championId: "Garen", level: 1, itemSets: [] },
      },
    ]
    store.getState().loadCanvas(nextNodes, [])
    expect(store.getState().nodes).toEqual(nextNodes)
    expect(store.getState().edges).toEqual([])
  })

  it("contributes no undo-able entry in either direction", () => {
    vi.useFakeTimers()
    const store = freshStore()
    const pastBefore = store.temporal.getState().pastStates.length
    store.getState().loadCanvas([], [])
    vi.advanceTimersByTime(1000)
    expect(store.temporal.getState().pastStates.length).toBe(pastBefore)
    expect(store.temporal.getState().futureStates.length).toBe(0)
  })
})

describe("graph store — history shaping", () => {
  it("a pure selection change is not recorded (transient UI state, not user input)", () => {
    vi.useFakeTimers()
    const store = freshStore()
    const pastBefore = store.temporal.getState().pastStates.length

    store
      .getState()
      .onNodesChange([{ id: DEFAULT_CHAMPION_NODE_ID, type: "select", selected: true }])
    vi.advanceTimersByTime(1000)

    expect(store.temporal.getState().pastStates.length).toBe(pastBefore)
  })

  it("a rapid burst of position changes (a drag) collapses into one checkpoint", () => {
    vi.useFakeTimers()
    const store = freshStore()
    const pastBefore = store.temporal.getState().pastStates.length
    const startPosition = store
      .getState()
      .nodes.find((node) => node.id === DEFAULT_CHAMPION_NODE_ID)?.position
    if (startPosition === undefined) {
      throw new Error("fixture node missing from default canvas")
    }

    // Simulate ~10 pointermove ticks of one continuous drag: each fires a
    // real position change (the store updates immediately, same as a real
    // drag), but they're all within one `HISTORY_BURST_MS` window.
    for (let tick = 1; tick <= 10; tick += 1) {
      store.getState().onNodesChange([
        {
          id: DEFAULT_CHAMPION_NODE_ID,
          type: "position",
          position: { x: startPosition.x + tick, y: startPosition.y },
          dragging: true,
        },
      ])
      vi.advanceTimersByTime(16)
    }
    // Let the burst go quiet and commit.
    vi.advanceTimersByTime(1000)

    expect(store.temporal.getState().pastStates.length).toBe(pastBefore + 1)

    // Undo restores the position from *before the whole drag*, not just
    // the last pixel-sized tick.
    store.temporal.getState().undo()
    const restored = store.getState().nodes.find((node) => node.id === DEFAULT_CHAMPION_NODE_ID)
    expect(restored?.position).toEqual(startPosition)
  })
})
