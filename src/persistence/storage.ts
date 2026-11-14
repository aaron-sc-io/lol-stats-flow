import { type MigrationFailure, migrateToLatest } from "./migrations"
import { err, ok, type Result } from "./result"
import type { CanvasDocument } from "./schema"

/**
 * The localStorage adapter (plan D14 deliverable 1). Every operation is
 * `Result`-typed and never throws — `localStorage.setItem` can throw on
 * quota, a private-browsing Safari can throw on *any* call, and a hand-
 * edited/corrupted entry can fail to `JSON.parse` — none of that may ever
 * crash autosave or the drawer; callers decide whether/how to toast it.
 *
 * Keys are prefixed with the full app name, not something short like
 * `lsf:` — GitHub Pages serves every repo under one user/org off the
 * *same* origin (`<user>.github.io`) at different paths, and `localStorage`
 * is scoped by origin, not path. An unprefixed or short-prefixed key could
 * collide with a completely unrelated project living at
 * `<user>.github.io/some-other-repo/`.
 */

const CANVAS_KEY_PREFIX = "lol-stats-flow:canvas:"
const LAST_OPENED_KEY = "lol-stats-flow:last-opened"

function canvasKey(id: string): string {
  return `${CANVAS_KEY_PREFIX}${id}`
}

export type StorageFailure =
  | { readonly kind: "quota-exceeded"; readonly message: string }
  | { readonly kind: "unavailable"; readonly message: string }
  | { readonly kind: "corrupt"; readonly message: string }
  | { readonly kind: "not-found"; readonly message: string }

export type CanvasSummary = {
  readonly id: string
  readonly name: string
  readonly patch: string
  readonly updatedAt: string
}

function describeError(error: unknown): string {
  return error instanceof Error ? error.message : String(error)
}

function isQuotaExceededError(error: unknown): boolean {
  if (!(error instanceof DOMException)) {
    return false
  }
  return (
    error.name === "QuotaExceededError" ||
    error.name === "NS_ERROR_DOM_QUOTA_REACHED" ||
    error.code === 22
  )
}

export function saveCanvas(document: CanvasDocument): Result<void, StorageFailure> {
  try {
    localStorage.setItem(canvasKey(document.id), JSON.stringify(document))
    return ok(undefined)
  } catch (error) {
    if (isQuotaExceededError(error)) {
      return err({
        kind: "quota-exceeded",
        message: "Browser storage is full — this change could not be saved.",
      })
    }
    return err({ kind: "unavailable", message: describeError(error) })
  }
}

/** Reads one canvas by id and migrates it to the current schema version —
 * the one read path every saved/last-opened canvas goes through, so a
 * legacy document on disk is validated exactly once, here, never deeper
 * in the app. */
export function loadCanvas(
  id: string,
  currentPatch: string,
): Result<CanvasDocument, StorageFailure | MigrationFailure> {
  let raw: string | null
  try {
    raw = localStorage.getItem(canvasKey(id))
  } catch (error) {
    return err({ kind: "unavailable", message: describeError(error) })
  }
  if (raw === null) {
    return err({ kind: "not-found", message: `No saved canvas with id "${id}".` })
  }

  let parsed: unknown
  try {
    parsed = JSON.parse(raw)
  } catch {
    return err({ kind: "corrupt", message: `The saved canvas "${id}" is corrupted.` })
  }

  return migrateToLatest(parsed, currentPatch)
}

export function deleteCanvas(id: string): Result<void, StorageFailure> {
  try {
    localStorage.removeItem(canvasKey(id))
    return ok(undefined)
  } catch (error) {
    return err({ kind: "unavailable", message: describeError(error) })
  }
}

/** Metadata for the drawer's canvas list, sorted newest-first. Duck-types
 * each raw entry directly instead of running it through the full
 * migration/validation pipeline (listing shouldn't pay for parsing every
 * canvas's entire graph) — a corrupt entry is skipped rather than crashing
 * the list, and a legacy v0 entry (no `patch` field yet) still shows up,
 * with a placeholder patch, instead of silently vanishing from the drawer
 * until the user happens to open it once. */
export function listCanvasSummaries(): readonly CanvasSummary[] {
  const summaries: CanvasSummary[] = []
  for (let index = 0; index < localStorage.length; index += 1) {
    const key = localStorage.key(index)
    if (key === null || !key.startsWith(CANVAS_KEY_PREFIX)) {
      continue
    }
    const raw = localStorage.getItem(key)
    if (raw === null) {
      continue
    }
    try {
      const parsed = JSON.parse(raw) as Record<string, unknown>
      const { id, name, updatedAt } = parsed
      if (typeof id === "string" && typeof name === "string" && typeof updatedAt === "string") {
        const patch = typeof parsed.patch === "string" ? parsed.patch : "—"
        summaries.push({ id, name, patch, updatedAt })
      }
    } catch {
      // Corrupt entry: omit it from the list rather than crash the drawer.
    }
  }
  return summaries.sort((a, b) => b.updatedAt.localeCompare(a.updatedAt))
}

export function getLastOpenedId(): string | null {
  try {
    return localStorage.getItem(LAST_OPENED_KEY)
  } catch {
    return null
  }
}

export function setLastOpenedId(id: string): void {
  try {
    localStorage.setItem(LAST_OPENED_KEY, id)
  } catch {
    // Non-critical: losing "last opened" only means the next boot falls
    // back to a fresh default canvas instead of restoring this one.
  }
}

export function clearLastOpenedId(): void {
  try {
    localStorage.removeItem(LAST_OPENED_KEY)
  } catch {
    // See setLastOpenedId.
  }
}
