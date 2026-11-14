import { compressToEncodedURIComponent, decompressFromEncodedURIComponent } from "lz-string"
import { generateId } from "@/graph/store-helpers"
import { type MigrationFailure, migrateToLatest } from "./migrations"
import { err, ok, type Result } from "./result"
import type { CanvasDocument } from "./schema"

/**
 * Share URL (plan D14 deliverable 1): `#c=<lz-string compressed JSON>`.
 * Encodes only the *shareable* subset of a document — `schemaVersion`,
 * `name`, `patch`, `graph` — never `id`/`createdAt`/`updatedAt`, since
 * decoding always creates a brand-new unsaved canvas rather than claiming
 * to *be* the sender's saved copy.
 */

const HASH_PREFIX = "#c="

function toShareablePayload(document: CanvasDocument) {
  return {
    schemaVersion: document.schemaVersion,
    name: document.name,
    patch: document.patch,
    graph: document.graph,
  }
}

/** Builds a full share URL from the current location plus a document —
 * clears any existing hash/query (e.g. `?view=gallery`) so the link is
 * exactly "this app, this canvas", nothing else. */
export function encodeShareUrl(document: CanvasDocument, currentHref: string): string {
  const url = new URL(currentHref)
  url.search = ""
  const compressed = compressToEncodedURIComponent(JSON.stringify(toShareablePayload(document)))
  url.hash = `c=${compressed}`
  return url.toString()
}

export type ShareDecodeFailure =
  | { readonly kind: "empty" }
  | { readonly kind: "decompress-failed" }
  | { readonly kind: "invalid-json" }
  | MigrationFailure

/** Decodes `location.hash` (which already includes the leading `#`) back
 * into a document. Never throws: every malformed-input path — an
 * unrelated hash, a truncated/garbled payload, valid compression wrapping
 * non-JSON, or valid JSON that fails schema validation — returns a typed
 * failure instead. Always re-stamps a fresh `id`/`createdAt`/`updatedAt`
 * on success: a decoded share link is a *new* unsaved canvas, never a
 * claim to be the sender's saved one. Runs through the same
 * `migrateToLatest` pipeline as disk/import reads (via a placeholder
 * identity Zod doesn't see anyway, since it's overwritten below) so a
 * share link encoded by an older app version still opens correctly. */
export function decodeShareHash(
  hash: string,
  currentPatch: string,
): Result<CanvasDocument, ShareDecodeFailure> {
  if (!hash.startsWith(HASH_PREFIX)) {
    return err({ kind: "empty" })
  }
  const payload = hash.slice(HASH_PREFIX.length)
  if (payload.length === 0) {
    return err({ kind: "empty" })
  }

  let decompressed: string | null
  try {
    decompressed = decompressFromEncodedURIComponent(payload)
  } catch {
    decompressed = null
  }
  if (decompressed === null || decompressed.length === 0) {
    return err({ kind: "decompress-failed" })
  }

  let parsed: unknown
  try {
    parsed = JSON.parse(decompressed)
  } catch {
    return err({ kind: "invalid-json" })
  }
  if (typeof parsed !== "object" || parsed === null) {
    return err({ kind: "invalid-json" })
  }

  const now = new Date().toISOString()
  const migrated = migrateToLatest(
    { id: "shared", createdAt: now, updatedAt: now, ...parsed },
    currentPatch,
  )
  if (!migrated.ok) {
    return migrated
  }

  return ok({ ...migrated.value, id: generateId("canvas"), createdAt: now, updatedAt: now })
}
