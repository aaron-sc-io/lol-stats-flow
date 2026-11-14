# lol-stats-flow

Interactive node-graph damage calculator for League of Legends — build champion
item sets, chain them into ability combos, and compare damage output against
targets on a themed [React Flow](https://reactflow.dev/) canvas.

Live: https://aaron-sc-io.github.io/lol-stats-flow/

Design system and UI spec: [DESIGN.md](./DESIGN.md)

## Scripts

| Command               | Does                                                                  |
| --------------------- | --------------------------------------------------------------------- |
| `npm run dev`         | Start the Vite dev server                                             |
| `npm run build`       | Typecheck (`tsc -b`) and build for production                         |
| `npm run preview`     | Preview the production build locally                                  |
| `npm run typecheck`   | Typecheck only                                                        |
| `npm run lint`        | Biome format + lint check                                             |
| `npm run lint:tokens` | Fail if raw colors/px font-sizes leak outside `src/styles/tokens.css` |
| `npm test`            | Unit tests (Vitest)                                                   |
| `npm run test:e2e`    | End-to-end tests (Playwright + axe)                                   |
| `npm run format`      | Biome write (format + organize imports)                               |

## Status

Phase 0 — repo bootstrap. Empty themed canvas only; no data pipeline, engine,
or nodes yet.
