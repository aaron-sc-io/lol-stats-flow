import { describe, expect, it } from "vitest"
import { createDefaultCanvas } from "@/graph/default-canvas"
import { buildCanvasDocument } from "./document"

describe("buildCanvasDocument", () => {
  it("builds a valid CanvasDocument from the real default canvas + meta", () => {
    const { nodes, edges } = createDefaultCanvas()

    const doc = buildCanvasDocument(
      {
        id: "canvas-1",
        name: "Untitled canvas",
        patch: "16.22.1",
        createdAt: "2026-11-14T00:00:00.000Z",
        updatedAt: "2026-11-14T00:00:00.000Z",
      },
      nodes,
      edges,
    )

    expect(doc.schemaVersion).toBe(1)
    expect(doc.graph.nodes).toHaveLength(3)
    expect(doc.graph.edges).toHaveLength(2)
  })
})
