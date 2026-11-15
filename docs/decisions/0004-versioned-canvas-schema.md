# 0004 - Versioned canvas schema; saved canvases and share links never break

**Context.** Canvases live in users' localStorage, exported JSON files and share URLs,
none of which we control.

**Decision.** `src/persistence/schema.ts` (Zod, `CANVAS_SCHEMA_VERSION`) defines the
document. Every untrusted read goes through `migrateToLatest` exactly once and returns a
typed failure instead of throwing. Changes that old data can't parse bump the version and
add a migration step plus a frozen fixture test. Each canvas pins the patch it was built
on; if that snapshot is still shipped the canvas loads on it, otherwise it is migrated to
the current patch with a notice.

**Consequences.** Persistence changes are a release-report risk item. Fixtures under
`src/persistence/__fixtures__/` are append-only.
