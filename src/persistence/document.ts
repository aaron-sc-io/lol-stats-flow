import { toCanonicalGraph } from "@/graph/store-helpers"
import type { FlowEdge, FlowNode } from "@/graph/types"
import {
  CANVAS_SCHEMA_VERSION,
  type CanvasDocument,
  CanvasDocumentSchema,
  type PersistedGraph,
} from "./schema"

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

/**
 * The reverse direction: a validated `CanvasDocument`'s `graph` (from
 * disk, a share URL, or a JSON import) is exactly a `FlowNode[]`/
 * `FlowEdge[]` in substance — every read path validates it via this same
 * schema before it ever reaches here — but Zod's inferred tuple/record
 * types are structurally wider/narrower than `@/graph/types`' hand-written
 * ones in ways plain assignment won't satisfy (e.g. a mutable 6-tuple vs
 * `ItemSet`'s `readonly` one). One cast, at this one named boundary,
 * instead of scattered `as unknown as` casts at every call site that
 * hands a loaded document to the graph store.
 */
export function toFlowGraph(graph: PersistedGraph): { nodes: FlowNode[]; edges: FlowEdge[] } {
  return {
    nodes: graph.nodes as unknown as FlowNode[],
    edges: graph.edges as unknown as FlowEdge[],
  }
}
