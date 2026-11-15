# src/persistence - rules

Saved canvases (localStorage), JSON import/export, share URL (`#c=<lz-string>`), autosave
and the per-canvas patch pin.

## Saved canvases never break

- `schema.ts` is the runtime source of truth for a saved canvas (`CANVAS_SCHEMA_VERSION`).
- Every untrusted read (storage load, share decode, JSON import) goes through
  `migrateToLatest` in `migrations.ts` **exactly once** and must never throw. Return
  `Result` failures instead.
- Backward-compatible additions (an optional field, or a `.transform` that maps a legacy
  value) need no version bump. Add a test that the old shape still parses.
- Anything old data can't parse needs:
  1. a `CANVAS_SCHEMA_VERSION` bump;
  2. a step in `MIGRATIONS`;
  3. a frozen fixture under `__fixtures__/canvas-v<N>.ts`;
  4. a test in `migrations.test.ts`.

  Never edit an existing fixture. Use the [`schema-migration`](../../.opencode/skills/schema-migration/SKILL.md) skill.
- Share links in the wild are permanent: anything `decodeShareHash` accepted before must
  still decode.
- The release report flags any change to `schema.ts`, `migrations.ts` or `share-url.ts`.

## Boundaries

- Depends on `graph/` (via `graph-bridge.ts`); `graph/` must never import this directory.
- `patch-pin.ts` contains pure decisions only; UI wiring lives in `src/app/PatchPinBanner.tsx`.
