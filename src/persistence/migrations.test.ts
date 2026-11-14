import { describe, expect, it } from "vitest"
import { CANVAS_V0_FIXTURE } from "./__fixtures__/canvas-v0"
import { migrateToLatest } from "./migrations"

const CURRENT_PATCH = "16.22.1"

describe("migrateToLatest", () => {
  it("migrates the v0 fixture to a valid v1 document, stamping schemaVersion and patch", () => {
    const result = migrateToLatest(CANVAS_V0_FIXTURE, CURRENT_PATCH)

    expect(result.ok).toBe(true)
    if (!result.ok) return
    expect(result.value.schemaVersion).toBe(1)
    expect(result.value.patch).toBe(CURRENT_PATCH)
    expect(result.value.id).toBe(CANVAS_V0_FIXTURE.id)
    expect(result.value.name).toBe(CANVAS_V0_FIXTURE.name)
    expect(result.value.createdAt).toBe(CANVAS_V0_FIXTURE.createdAt)
    expect(result.value.graph.nodes).toHaveLength(3)
    expect(result.value.graph.edges).toHaveLength(2)
    const graphNode = result.value.graph.nodes.find((node) => node.type === "graph")
    expect(graphNode).toBeDefined()
    expect(graphNode?.data).toMatchObject({ activeTargetIds: ["target-legacy-1"] })
  })

  it("passes an already-current (v1) document through unchanged", () => {
    const migrated = migrateToLatest(CANVAS_V0_FIXTURE, CURRENT_PATCH)
    if (!migrated.ok) throw new Error("fixture migration should succeed")

    const result = migrateToLatest(migrated.value, "16.23.1")

    expect(result.ok).toBe(true)
    // Already v1 -> no migration step runs, so `patch` is NOT bumped to
    // the "current patch" passed to this second call; that's exactly the
    // patch-pin feature's job, not migration's.
    if (result.ok) expect(result.value.patch).toBe(CURRENT_PATCH)
  })

  it("rejects non-object input instead of throwing", () => {
    const result = migrateToLatest("not an object", CURRENT_PATCH)

    expect(result.ok).toBe(false)
    if (!result.ok) expect(result.error.kind).toBe("invalid-input")
  })

  it("rejects null input instead of throwing", () => {
    const result = migrateToLatest(null, CURRENT_PATCH)

    expect(result.ok).toBe(false)
    if (!result.ok) expect(result.error.kind).toBe("invalid-input")
  })

  it("rejects a document from a newer, not-yet-understood schema version", () => {
    const result = migrateToLatest(
      { schemaVersion: 2, id: "x", name: "x", patch: "x", createdAt: "x", updatedAt: "x" },
      CURRENT_PATCH,
    )

    expect(result.ok).toBe(false)
    if (!result.ok) expect(result.error.kind).toBe("validation-failed")
  })

  it("rejects a v0-shaped document whose graph fails validation after migration", () => {
    const result = migrateToLatest(
      { id: "x", name: "x", createdAt: "x", updatedAt: "x", graph: { nodes: "not an array" } },
      CURRENT_PATCH,
    )

    expect(result.ok).toBe(false)
    if (!result.ok) expect(result.error.kind).toBe("validation-failed")
  })
})
