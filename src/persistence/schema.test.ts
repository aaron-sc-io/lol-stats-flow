import { describe, expect, it } from "vitest"
import { createDefaultCanvas } from "@/graph/default-canvas"
import { toCanonicalGraph } from "@/graph/store-helpers"
import { CANVAS_SCHEMA_VERSION, CanvasDocumentSchema } from "./schema"

const BASE_FIELDS = {
  id: "canvas-1",
  name: "My canvas",
  patch: "16.22.1",
  createdAt: "2026-11-14T00:00:00.000Z",
  updatedAt: "2026-11-14T00:00:00.000Z",
}

describe("CanvasDocumentSchema", () => {
  it("round-trips the real default canvas with no data loss", () => {
    const { nodes, edges } = createDefaultCanvas()
    const doc = {
      schemaVersion: CANVAS_SCHEMA_VERSION,
      ...BASE_FIELDS,
      graph: toCanonicalGraph(nodes, edges),
    }

    const parsed = CanvasDocumentSchema.parse(doc)

    expect(parsed).toEqual(doc)
    expect(parsed.graph.nodes).toHaveLength(3)
    expect(parsed.graph.edges).toHaveLength(2)
  })

  it("rejects a document with the wrong schemaVersion literal", () => {
    const { nodes, edges } = createDefaultCanvas()
    const doc = {
      schemaVersion: 2,
      ...BASE_FIELDS,
      graph: toCanonicalGraph(nodes, edges),
    }

    expect(() => CanvasDocumentSchema.parse(doc)).toThrow()
  })

  it("rejects a node whose type doesn't match any discriminated variant", () => {
    const doc = {
      schemaVersion: CANVAS_SCHEMA_VERSION,
      ...BASE_FIELDS,
      graph: {
        nodes: [{ id: "n1", type: "unknown", position: { x: 0, y: 0 }, data: {} }],
        edges: [],
      },
    }

    expect(() => CanvasDocumentSchema.parse(doc)).toThrow()
  })

  it("rejects a champion node whose data doesn't match ChampionNodeDataSchema", () => {
    const doc = {
      schemaVersion: CANVAS_SCHEMA_VERSION,
      ...BASE_FIELDS,
      graph: {
        nodes: [
          {
            id: "n1",
            type: "champion",
            position: { x: 0, y: 0 },
            data: { championId: "Yasuo" /* missing level, itemSets */ },
          },
        ],
        edges: [],
      },
    }

    expect(() => CanvasDocumentSchema.parse(doc)).toThrow()
  })

  it("accepts an item set with every slot empty and no rank overrides", () => {
    const { nodes, edges } = createDefaultCanvas()
    const emptied = nodes.map((node) =>
      node.type === "champion"
        ? {
            ...node,
            data: {
              ...node.data,
              itemSets: node.data.itemSets.map((itemSet) => ({
                ...itemSet,
                items: [null, null, null, null, null, null] as const,
                rankOverrides: {},
              })),
            },
          }
        : node,
    )

    expect(() =>
      CanvasDocumentSchema.parse({
        schemaVersion: CANVAS_SCHEMA_VERSION,
        ...BASE_FIELDS,
        graph: toCanonicalGraph(emptied, edges),
      }),
    ).not.toThrow()
  })
})
