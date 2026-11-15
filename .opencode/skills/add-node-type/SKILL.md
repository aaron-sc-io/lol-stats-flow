---

name: add-node-type
description: Add a new React Flow node type (beyond Champion/Combo/Graph) to lol-stats-flow end to end - graph types, handles, connection rules, store slice, persistence schema, UI, add-node menu, tests. Use when the user wants a new kind of node on the canvas.
---

# Add a node type

Touches every layer, in this order:

1. **Graph model** (`src/graph`):
   - add the `type` and data shape in `types.ts`;
   - handle ids in `handle-ids.ts`;
   - allowed edges in `connection-rules.ts` + `connection-rules.test.ts`;
   - a slice `<x>-slice.ts`, wired into `store.ts`;
   - include it in `store-helpers.ts` `toCanonicalGraph`.

   Derived numbers go in a cache or selector, not the store (ADR 0003).
2. **Persistence**: add a branch to `PersistedNodeSchema` in `src/persistence/schema.ts`.
   Adding a union member is backward compatible, so no version bump is needed, but run the
   `schema-migration` checklist anyway. Extend the round-trip test.
3. **UI** (`src/nodes/<Name>Node/`): built on `NodeFrame` and following the `node-styling`
   skill. Register it in `NODE_TYPES` in `src/app/App.tsx` and add it to `AddNodeMenu`.
4. **Tests**: unit tests for the node; an e2e flow in `tests/e2e/` (add, connect, values
   update, undo, reload restores it).
5. **Docs**: update `src/nodes/AGENTS.md`, `docs/architecture.md` (edge list) and `DESIGN.md`
   if there are new visual rules.
6. Run `just verify-full` and check it in the browser.
