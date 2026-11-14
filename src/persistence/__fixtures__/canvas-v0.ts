/**
 * A legacy "v0" canvas document — the shape canvases were saved in before
 * this app had `schemaVersion`/`patch` fields at all (plan D14 deliverable
 * 1: "migrations registry (v0→v1 fixture test)"). Hand-written as a plain
 * literal (no imports from `@/graph/**`) so both
 * `src/persistence/migrations.test.ts` (via Vitest) and
 * `tests/e2e/persistence.spec.ts` (via Playwright, seeding localStorage
 * with `page.addInitScript` before the app loads) can import the exact
 * same fixture — see `tsconfig.node.json`, which whitelists this one file
 * for the "node"/tests TypeScript project the same way it already
 * whitelists individual `src/data`/`src/engine` files for `scripts/data/**`.
 *
 * Deliberately missing `schemaVersion` and `patch` — the two fields
 * `migrations.ts`'s v0→v1 step adds. Everything else already matches the
 * current `graph: { nodes, edges }` shape, since the graph/store model
 * itself hasn't changed shape across this migration, only the document
 * envelope around it.
 */
export const CANVAS_V0_FIXTURE = {
  id: "legacy-canvas-v0",
  name: "Pre-patch-pin canvas",
  createdAt: "2026-01-05T12:00:00.000Z",
  updatedAt: "2026-01-06T09:30:00.000Z",
  graph: {
    nodes: [
      {
        id: "champion-legacy-1",
        type: "champion",
        position: { x: 0, y: 0 },
        data: {
          championId: "Yasuo",
          level: 11,
          itemSets: [
            {
              id: "itemset-legacy-1",
              name: "Infinity Edge",
              items: [3031, null, null, null, null, null],
              rankOverrides: {},
            },
          ],
        },
      },
      {
        id: "combo-legacy-1",
        type: "combo",
        position: { x: 640, y: 0 },
        data: {
          name: "Combo 1",
          steps: [
            { id: "step-legacy-1", sourceId: "itemset-legacy-1", actionId: "Q" },
            { id: "step-legacy-2", sourceId: "itemset-legacy-1", actionId: "AA" },
          ],
          collapsedSections: [],
        },
      },
      {
        id: "graph-legacy-1",
        type: "graph",
        position: { x: 1040, y: 0 },
        data: {
          targets: [
            {
              id: "target-legacy-1",
              name: "Target 1",
              maxHp: 2000,
              bonusHp: 0,
              armor: 80,
              magicResist: 50,
            },
          ],
          activeTargetId: "target-legacy-1",
          chartType: "cumulative",
          xMode: "step",
        },
      },
    ],
    edges: [
      {
        id: "edge-legacy-1",
        source: "champion-legacy-1",
        sourceHandle: "itemset:itemset-legacy-1",
        target: "combo-legacy-1",
        targetHandle: "sources",
        type: "flow",
      },
      {
        id: "edge-legacy-2",
        source: "combo-legacy-1",
        sourceHandle: "out",
        target: "graph-legacy-1",
        targetHandle: "combos",
        type: "flow",
      },
    ],
  },
} as const
