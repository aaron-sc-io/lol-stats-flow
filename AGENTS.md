# AGENTS.md - lol-stats-flow

Static React Flow app: **Champion (item sets) → Combo → Graph (targets) → comparison table**,
a League of Legends damage calculator deployed to GitHub Pages. This repo is maintained
by agents. Read this file first; nested `AGENTS.md` files add rules for their directory.

## Autonomy policy

- Agents may change, merge and ship anything once CI is green - **except versioning**.
- **Versioning requires human approval.** Never edit `package.json` `version`, create tags,
  or publish releases by hand. Use the [`cut-release`](.opencode/skills/cut-release/SKILL.md)
  skill: it generates a safety report in [`docs/releases/`](docs/releases/README.md) and opens
  a `release` PR that a human must approve. Never approve or auto-merge a `release` PR.
- When a rule here conflicts with the code, fix whichever is wrong in the same change.

## Definition of done

1. `just verify` passes (lint, lint:tokens, lint:docs, typecheck, unit tests, build).
2. UI or interaction changes: also `npm run test:e2e` (or `just verify-full`), and check it
   in a browser. Visual baselines only change on purpose (`-chromium-linux.png` come from CI).
3. Docs touched by the change are updated (`AGENTS.md`, `docs/`, `DESIGN.md`, skills).
4. Conventional commit messages (`feat(scope): …`, `fix(…)`, `chore(…)`, `test(…)`,
   `docs(…)`; `!` for breaking). The release report derives the semver bump from them.

## Commands

| Command                               | Use                                     |
| ------------------------------------- | --------------------------------------- |
| `just verify`                         | Agent "done" gate (no e2e)              |
| `just verify-full`                    | `verify` + Playwright e2e               |
| `npm run dev`                         | Vite dev server                         |
| `npm test` / `npx vitest run <path>`  | Unit + golden tests                     |
| `npm run test:e2e`                    | Playwright + axe                        |
| `npm run format`                      | Biome write                             |
| `npm run data:sync -- --patch latest` | Fetch + normalize a snapshot            |
| `npm run data:gates -- --patch <p>`   | Snapshot validation gates               |
| `npm run release:report`              | Version safety report (dry run, stdout) |

## Module map

| Path                        | Responsibility                                                         | Rules                               |
| --------------------------- | ---------------------------------------------------------------------- | ----------------------------------- |
| `src/engine`                | Pure TS damage engine: stats, formula compiler, effect primitives, sim | [AGENTS](src/engine/AGENTS.md)      |
| `src/data`                  | Snapshot schema (Zod), loader, selectors                               | [AGENTS](src/data/AGENTS.md)        |
| `src/graph`                 | Zustand+zundo store, connection rules, derived caches                  | [AGENTS](src/graph/AGENTS.md)       |
| `src/persistence`           | Saved canvas schema, migrations, autosave, share URL, patch pin        | [AGENTS](src/persistence/AGENTS.md) |
| `src/nodes`                 | Champion / Combo / Graph React Flow nodes                              | [AGENTS](src/nodes/AGENTS.md)       |
| `src/components`            | Design-system primitives (HoverPicker, NodeFrame, …)                   | [AGENTS](src/components/AGENTS.md)  |
| `src/app`                   | Shell: TopBar, Drawer, AddNodeMenu, gallery (`?view=gallery`)          | [AGENTS](src/app/AGENTS.md)         |
| `src/lib`                   | Tiny framework-free helpers (`cx`, `assert-never`, positioning)        | none                                |
| `src/styles`                | `tokens.css` (only place for raw values), global + React Flow theme    | [DESIGN.md](DESIGN.md)              |
| `scripts/data`              | Build-time fetch/normalize/diff/coverage pipeline                      | [AGENTS](scripts/AGENTS.md)         |
| `scripts/gates`             | Patch-sync gates, demotion, sync state                                 | [AGENTS](scripts/AGENTS.md)         |
| `scripts/release`           | Release safety report                                                  | [AGENTS](scripts/AGENTS.md)         |
| `scripts/__fixtures__`      | Fixtures for script tests                                              | none                                |
| `data/`                     | Committed snapshots; written only by the pipeline                      | [AGENTS](scripts/AGENTS.md)         |
| `tests/e2e`, `tests/health` | Playwright suites (local / deployed site)                              | -                                   |

Dependency direction: `engine` ← `data` types only; `graph` → `engine`, `data`;
`persistence` → `graph` (never the reverse); `nodes`/`app` → everything; `components`
import nothing app-specific.

## Hard invariants

- **TypeScript strict**, no `any`, no `!` non-null, no `@ts-ignore` (Biome enforces).
- **Design tokens only**: no hex/rgb/hsl or px font sizes outside `src/styles/tokens.css`
  (`npm run lint:tokens`). Visual rules live in [DESIGN.md](DESIGN.md).
- **Engine is pure**: no React, no DOM, deterministic. Effect primitives are a fixed set
  ([ADR 0002](docs/decisions/0002-formula-compiler-and-fixed-primitives.md)); adding one is
  a product decision - flag it to the human.
- **Store holds canonical input only**; every number is derived
  ([ADR 0003](docs/decisions/0003-canonical-store-derived-numbers.md)).
- **Saved canvases never break**: any change to `src/persistence/schema.ts` that old data
  can't parse needs a `CANVAS_SCHEMA_VERSION` bump + migration + fixture test
  ([schema-migration skill](.opencode/skills/schema-migration/SKILL.md)).
- **Never hand-edit `data/`** or golden fixtures to make a test pass.

## Where to read more

- [docs/architecture.md](docs/architecture.md) - data flow and module boundaries.
- [docs/decisions/](docs/decisions/README.md) - why things are the way they are.
- [docs/roadmap.md](docs/roadmap.md) - history (phases 0-6) and open work.
- [docs/releases/](docs/releases/README.md) - release safety reports.
- [README.md](README.md) - automation (patch-sync, health, Dependabot).
- Skills in `.opencode/skills/`: `node-styling`, `add-champion-binding`,
  `add-effect-primitive`, `add-component`, `add-node-type`, `schema-migration`,
  `resolve-patch-sync-issue`, `cut-release`.
