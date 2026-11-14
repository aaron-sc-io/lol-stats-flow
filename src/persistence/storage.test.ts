import { beforeEach, describe, expect, it, vi } from "vitest"
import { CANVAS_V0_FIXTURE } from "./__fixtures__/canvas-v0"
import {
  clearLastOpenedId,
  deleteCanvas,
  getLastOpenedId,
  listCanvasSummaries,
  loadCanvas,
  saveCanvas,
  setLastOpenedId,
} from "./storage"

const CURRENT_PATCH = "16.22.1"
// Mirrors `storage.ts`'s private `canvasKey` — duplicated deliberately so
// this test also pins the on-disk key format against accidental drift.
const CANVAS_KEY_PREFIX = "lol-stats-flow:canvas:"

function aDocument(overrides: { readonly id: string; readonly updatedAt: string }) {
  return {
    schemaVersion: 1 as const,
    id: overrides.id,
    name: `Canvas ${overrides.id}`,
    patch: CURRENT_PATCH,
    createdAt: overrides.updatedAt,
    updatedAt: overrides.updatedAt,
    graph: { nodes: [], edges: [] },
  }
}

beforeEach(() => {
  localStorage.clear()
})

describe("saveCanvas / loadCanvas", () => {
  it("round-trips a document exactly", () => {
    const doc = aDocument({ id: "c1", updatedAt: "2026-01-01T00:00:00.000Z" })

    expect(saveCanvas(doc).ok).toBe(true)
    const result = loadCanvas("c1", CURRENT_PATCH)

    expect(result.ok).toBe(true)
    if (result.ok) expect(result.value).toEqual(doc)
  })

  it("returns a not-found error for a missing id instead of throwing", () => {
    const result = loadCanvas("does-not-exist", CURRENT_PATCH)

    expect(result.ok).toBe(false)
    if (!result.ok) expect(result.error.kind).toBe("not-found")
  })

  it("returns a corrupt error for unparseable JSON instead of throwing", () => {
    localStorage.setItem(`${CANVAS_KEY_PREFIX}bad`, "{not json")

    const result = loadCanvas("bad", CURRENT_PATCH)

    expect(result.ok).toBe(false)
    if (!result.ok) expect(result.error.kind).toBe("corrupt")
  })

  it("migrates a legacy v0 entry found on disk", () => {
    localStorage.setItem(
      `${CANVAS_KEY_PREFIX}${CANVAS_V0_FIXTURE.id}`,
      JSON.stringify(CANVAS_V0_FIXTURE),
    )

    const result = loadCanvas(CANVAS_V0_FIXTURE.id, CURRENT_PATCH)

    expect(result.ok).toBe(true)
    if (result.ok) {
      expect(result.value.schemaVersion).toBe(1)
      expect(result.value.patch).toBe(CURRENT_PATCH)
    }
  })

  it("reports quota-exceeded instead of throwing/crashing when storage is full", () => {
    const spy = vi.spyOn(Storage.prototype, "setItem").mockImplementation(() => {
      throw new DOMException("quota exceeded", "QuotaExceededError")
    })

    const result = saveCanvas(aDocument({ id: "c1", updatedAt: "2026-01-01T00:00:00.000Z" }))

    expect(result.ok).toBe(false)
    if (!result.ok) expect(result.error.kind).toBe("quota-exceeded")
    spy.mockRestore()
  })
})

describe("deleteCanvas", () => {
  it("removes a saved canvas so it can no longer be loaded", () => {
    saveCanvas(aDocument({ id: "c1", updatedAt: "2026-01-01T00:00:00.000Z" }))

    expect(deleteCanvas("c1").ok).toBe(true)
    expect(loadCanvas("c1", CURRENT_PATCH).ok).toBe(false)
  })
})

describe("listCanvasSummaries", () => {
  it("lists saved canvases sorted newest-updatedAt-first, skipping corrupt entries", () => {
    saveCanvas(aDocument({ id: "older", updatedAt: "2026-01-01T00:00:00.000Z" }))
    saveCanvas(aDocument({ id: "newer", updatedAt: "2026-02-01T00:00:00.000Z" }))
    localStorage.setItem(`${CANVAS_KEY_PREFIX}corrupt`, "{not json")

    const summaries = listCanvasSummaries()

    expect(summaries.map((s) => s.id)).toEqual(["newer", "older"])
  })

  it("still lists a legacy entry with no patch field, using a placeholder", () => {
    localStorage.setItem(
      `${CANVAS_KEY_PREFIX}${CANVAS_V0_FIXTURE.id}`,
      JSON.stringify(CANVAS_V0_FIXTURE),
    )

    const summaries = listCanvasSummaries()

    expect(summaries).toHaveLength(1)
    expect(summaries[0]).toMatchObject({ id: CANVAS_V0_FIXTURE.id, patch: "—" })
  })

  it("ignores unrelated localStorage keys from other GitHub Pages projects on the same origin", () => {
    localStorage.setItem(
      "some-other-repo:settings",
      JSON.stringify({ id: "x", name: "x", updatedAt: "x" }),
    )

    expect(listCanvasSummaries()).toEqual([])
  })
})

describe("last-opened id", () => {
  it("round-trips get/set/clear", () => {
    expect(getLastOpenedId()).toBeNull()

    setLastOpenedId("c1")
    expect(getLastOpenedId()).toBe("c1")

    clearLastOpenedId()
    expect(getLastOpenedId()).toBeNull()
  })
})
