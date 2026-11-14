import { err, ok, type Result } from "./result"
import { CANVAS_SCHEMA_VERSION, type CanvasDocument, CanvasDocumentSchema } from "./schema"

/**
 * Migration registry (plan D14 deliverable 1: "migrations registry (v0→v1
 * fixture test)"). `migrateToLatest` is the one entry point every
 * untrusted read goes through exactly once — `storage.ts` on load,
 * `share-url.ts` on decode, and the drawer's JSON import — each of them a
 * boundary that can receive data from an older build, a hand-edited file,
 * or garbage, and must never throw.
 */

export type MigrationFailure =
  | { readonly kind: "invalid-input"; readonly message: string }
  | { readonly kind: "unknown-version"; readonly version: number }
  | { readonly kind: "validation-failed"; readonly message: string }

function detectVersion(raw: object): number {
  if ("schemaVersion" in raw) {
    const value = (raw as { readonly schemaVersion?: unknown }).schemaVersion
    if (typeof value === "number") {
      return value
    }
  }
  return 0
}

/** v0 -> v1: stamp the two fields that didn't exist before schema
 * versioning and patch-pin shipped. `patch` can't be recovered — v0
 * canvases never recorded it — so falling back to whatever patch is
 * current when the migration runs is the only sound choice, and also the
 * *safe* one: `decidePatchPin` reports "current" for it, so a migrated
 * legacy canvas never shows a stale patch-pin banner it has no real data
 * to back up. */
function migrateV0ToV1(
  raw: Record<string, unknown>,
  currentPatch: string,
): Record<string, unknown> {
  return { ...raw, schemaVersion: 1, patch: currentPatch }
}

type MigrationStep = (raw: Record<string, unknown>, currentPatch: string) => Record<string, unknown>

const MIGRATIONS: Readonly<Record<number, MigrationStep>> = {
  0: migrateV0ToV1,
}

export function migrateToLatest(
  raw: unknown,
  currentPatch: string,
): Result<CanvasDocument, MigrationFailure> {
  if (typeof raw !== "object" || raw === null) {
    return err({ kind: "invalid-input", message: "Canvas document is not an object" })
  }

  let version = detectVersion(raw)
  let working = raw as Record<string, unknown>
  while (version < CANVAS_SCHEMA_VERSION) {
    const migrate = MIGRATIONS[version]
    if (migrate === undefined) {
      return err({ kind: "unknown-version", version })
    }
    working = migrate(working, currentPatch)
    version += 1
  }

  const parsed = CanvasDocumentSchema.safeParse(working)
  if (!parsed.success) {
    return err({ kind: "validation-failed", message: parsed.error.message })
  }
  return ok(parsed.data)
}
