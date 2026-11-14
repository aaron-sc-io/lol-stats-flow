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
| `npm run test:health` | Deployed-site smoke test (Playwright, against GitHub Pages)           |
| `npm run format`      | Biome write (format + organize imports)                               |
| `npm run data:sync`   | Fetch + normalize a patch snapshot (`-- --patch latest`)               |
| `npm run data:gates`  | Schema/structural/coverage/size/golden validation gates for a patch    |
| `npm run data:diff`   | Patch-to-patch change report                                          |
| `npm run data:coverage` | Formula/binding coverage report                                     |

## Status

Phase 6 — automation hardening. Data pipeline, engine, graph UI, persistence,
and `patch-sync`/`health` automation are all live.

## Maintenance

This repo is designed to need **no recurring human maintenance**. Automation
runs on a schedule and self-heals; a human is only ever needed for the one
case called out at the bottom.

| What | Runs | Does |
| --- | --- | --- |
| [`patch-sync.yml`](.github/workflows/patch-sync.yml) | Daily (+ manual `workflow_dispatch`) | Detects a new DDragon patch, fetches + normalizes it, runs `npm run data:gates`, and either opens an auto-merging PR (`patch-sync` + `automerge` labels) or, if only specific modeled entities fail, auto-demotes them (`modeled: false`, badged in the UI) and still opens the PR plus a `patch-sync-demotion`-labelled issue. If gates fail with nothing demotable, it opens a `patch-sync-failure` issue and leaves `main` on the last good snapshot. |
| Flaky-source tolerance | Part of `patch-sync.yml` | A CDragon/DDragon fetch failure doesn't open an issue immediately — state is tracked on the orphan `patch-sync-state` branch (`scripts/gates/sync-state.ts`) and an issue (`patch-sync-flaky`) only opens after 3 consecutive failed scheduled runs. |
| [`health.yml`](.github/workflows/health.yml) | Weekly (+ manual) | Playwright smoke test against the **deployed** Pages URL: default canvas renders with zero console errors, a share link round-trips. Failure opens/updates a `health-check-failure` issue. |
| [`ci.yml`](.github/workflows/ci.yml) | Every push/PR | Lint, typecheck, unit + golden tests, build, e2e; also runs `npm run data:gates` when `data/**` or the data scripts change. Required status check for branch protection + auto-merge. |
| [`dependabot.yml`](.github/dependabot.yml) + [`dependabot-automerge.yml`](.github/workflows/dependabot-automerge.yml) | Weekly | Minor/patch dependency updates (npm + GitHub Actions) auto-merge once CI is green; majors stay open for manual review. (The Renovate GitHub App isn't installed — see the comment in `dependabot.yml` — so Dependabot is the active mechanism; `renovate.json` is kept inert in case the app is installed later.) |
| Snapshot retention | Part of `patch-sync.yml` | Keeps the last 3 patch snapshots under `data/snapshots/`; `src/data/loader.ts`'s patch list is derived from whatever directories exist, so pruning *is* the manifest update. |

### When a human is actually needed

- **A new mechanic type appears that the fixed effect-primitive set
  (`src/engine/effects/`) can't express** (plan §4.3) — gates will keep
  passing (structurally nothing broke), but the new mechanic won't be
  modeled until a human adds a primitive + binding. Nothing pages for this;
  it's a product decision, not a failure. Everything else — patch bumps,
  dependency updates, transient fetch failures, demotions, deploys — runs
  unattended.
