import { toCanonicalGraph } from "@/graph/store-helpers"
import type { FlowEdge, FlowNode } from "@/graph/types"
import { CANVAS_SCHEMA_VERSION, type CanvasDocument, CanvasDocumentSchema } from "./schema"

/** The per-canvas identity/timestamp fields that live alongside the graph
 * itself — everything in `CanvasDocument` except `graph`. */
export type CanvasMeta = {
  readonly id: string
  readonly name: string
  readonly patch: string
  readonly createdAt: string
  readonly updatedAt: string
}

/**
 * Builds the one saved/exported/shared document shape from the graph
 * store's live `nodes`/`edges` plus this canvas's identity — the shared
 * step behind autosave, JSON export, and the share-URL encoder, so all
 * three always save exactly the same thing. Round-trips through
 * `CanvasDocumentSchema.parse` rather than returning a hand-typed object
 * literal: `toCanonicalGraph`'s readonly tuples/records are structurally
 * narrower than Zod's inferred (mutable) ones, and re-validating what was
 * just built from the live, type-checked store is a cheap, genuine
 * assertion — if it ever fails, that's a real bug to surface loudly, not
 * silently paper over with a type cast.
 */
export function buildCanvasDocument(
  meta: CanvasMeta,
  nodes: readonly FlowNode[],
  edges: readonly FlowEdge[],
): CanvasDocument {
  return CanvasDocumentSchema.parse({
    schemaVersion: CANVAS_SCHEMA_VERSION,
    id: meta.id,
    name: meta.name,
    patch: meta.patch,
    createdAt: meta.createdAt,
    updatedAt: meta.updatedAt,
    graph: toCanonicalGraph(nodes, edges),
  })
}
