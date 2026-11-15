---

name: schema-migration
description: Safely change the persisted canvas format in lol-stats-flow (src/persistence/schema.ts, migrations.ts, share-url.ts) or the graph canonical shape it mirrors. Use whenever a change touches saved-canvas fields, node data shapes, share URL encoding, or CANVAS_SCHEMA_VERSION.
---

# Canvas schema change

Old localStorage canvases, exported JSON and share links must keep opening (ADR 0004).

## 1. Classify the change

| Change                                                                            | Version bump?                              |
| --------------------------------------------------------------------------------- | ------------------------------------------ |
| New optional field, new union member, widened enum                                | No. Add a "legacy shape still parses" test |
| Rename/remove a field, narrow a type, change meaning                              | **Yes**                                    |
| Legacy value that maps cleanly (`.transform`, e.g. chart `"bars"`→`"cumulative"`) | No, if it's covered by a test              |

## 2. If a bump is needed

1. Freeze the current shape: add `src/persistence/__fixtures__/canvas-v<N>.ts`, a real
   document produced by the current code. Never edit existing fixtures.
2. Bump `CANVAS_SCHEMA_VERSION` in `schema.ts` and update the schema.
3. Add `MIGRATIONS[N] = migrateV<N>ToV<N+1>` in `migrations.ts`. It must be a pure
   function on plain objects; don't import the old schema.
4. Tests in `migrations.test.ts`: the v<N> fixture migrates to valid latest, previous
   fixtures still chain through, and garbage returns a failure without throwing.
5. Share URLs: an old `#c=` payload must still decode. Add a case to `share-url.test.ts`
   using an encoded old fixture.
6. Update `src/graph` types and `toCanonicalGraph` together. `schema.test.ts` round-trips
   `createDefaultCanvas()`.

## 3. Finish

Run `just verify` and `npx playwright test persistence`. The release report flags
persistence changes automatically; describe the migration in the PR body.
