# src/data - rules

Snapshot types and runtime loading. Snapshot JSON lives in `data/snapshots/<patch>/` and is
produced only by `scripts/data` (see [scripts/AGENTS.md](../../scripts/AGENTS.md)).

- `snapshot-schema.ts` / `formula-schema.ts` are the Zod source of truth
  (`SNAPSHOT_SCHEMA_VERSION`). A breaking change here needs: a version bump, regenerated
  snapshots via `npm run data:sync`, and updates to the schema gate. Old snapshots are not
  migrated; they're regenerated.
- `loader.ts` reads only same-origin snapshot JSON via `import.meta.glob`. There is no
  runtime fetch to CDragon/DDragon except DDragon image URLs
  ([ADR 0001](../../docs/decisions/0001-build-time-snapshots.md)). The available patch
  list is whatever directories exist.
- Files listed in `tsconfig.node.json` `include` (schema, stat-ids, selectors) are also
  used by Node scripts and must stay free of Vite/DOM APIs.
- `snapshot-context.tsx` / `use-snapshot.ts` are the React boundary.
