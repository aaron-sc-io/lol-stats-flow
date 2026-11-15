# src/graph - rules

Zustand store (`store.ts`) composed from slices (`champion-`, `combo-`, `graph-`,
`flow-slice.ts`), wrapped in zundo `temporal` for undo/redo.

## Invariants

- **The store holds canonical user input only**: node/edge typing and positions,
  champion id/level/item sets, combo steps, targets and graph options. Kits, sim results,
  chart points and comparison rows are **derived** in `kit-cache.ts`, `sim-cache.ts`,
  `chart-points.ts`, `comparison-row.ts` and `graph-node-derivation.ts`
  ([ADR 0003](../../docs/decisions/0003-canonical-store-derived-numbers.md)).
- Undo history tracks `toCanonicalGraph()` only. Transient UI state (hover, selection,
  dragging) must stay out of it. Rapid changes coalesce into one history entry
  (`HISTORY_BURST_MS`).
- Connections are validated by `connection-rules.ts`; handle ids come from
  `handle-ids.ts`. Never build handle strings inline.
- Removing a source (champion / item set / edge) **orphans** dependent combo steps; it
  never deletes them.
- `graph/` must never import `persistence/`. If you change the canonical shape (`types.ts`,
  `store-helpers.ts` `toCanonicalGraph`), also update `src/persistence/schema.ts`. The
  round-trip test in `persistence/schema.test.ts` will fail otherwise. Follow the
  `schema-migration` skill.

## Tests

Slice and selector behavior is unit-tested here; shared fixtures are in `test-support/`.
