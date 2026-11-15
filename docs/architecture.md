# Architecture

```
DDragon + CDragon ──(build time: scripts/data)──▶ data/snapshots/<patch>/*.json
                                                        │ import.meta.glob (src/data/loader.ts)
                                                        ▼
         Graph store (src/graph, canonical input) ──▶ kit-cache ──▶ sim-cache ──▶ chart-points / comparison-row
           ▲      │                                    (src/engine: buildKit, simulate)
           │      └──▶ src/persistence (autosave, share URL, import/export, patch pin)
           │
     src/nodes + src/app (React Flow UI, built from src/components)
```

## Layers

1. **Data pipeline** (`scripts/data`, build time only). Fetches DDragon (assets, versions)
   and CDragon game-bin JSON (stats, per-rank data values, `mSpellCalculations` formula
   trees), normalizes them into a Zod-validated snapshot, and commits it. The runtime
   never calls CDragon ([ADR 0001](decisions/0001-build-time-snapshots.md)).
2. **Snapshot types** (`src/data`). The Zod schema is the contract between the pipeline
   and the app. The loader code-splits each patch and keeps the last 3 patches for
   patch-pinned canvases.
3. **Engine** (`src/engine`, pure TS). `buildKit(snapshot, {championId, level, items,
   rankOverrides})` returns resolved stats, simulate-able `ComboAction`s and
   `PassiveRule`s. `simulate()` runs a deterministic event queue for each combo × target
   and returns `DamageInstance[]` plus totals, kill time and overkill. Formula trees are
   compiled and then bound onto a fixed set of effect primitives
   ([ADR 0002](decisions/0002-formula-compiler-and-fixed-primitives.md)).
4. **Graph store** (`src/graph`). Zustand + zundo. It holds canonical input only; all
   numbers are derived through memoized caches keyed by input
   ([ADR 0003](decisions/0003-canonical-store-derived-numbers.md)). Edges:
   `champion.itemSet[i] → combo.sources → combo.out → graph.combos`.
5. **Persistence** (`src/persistence`). A versioned canvas document and a migration
   pipeline that every untrusted read goes through. Share URL is `#c=<lz-string>`. The
   patch pin decides whether a canvas loads on its original snapshot or migrates to the
   current one ([ADR 0004](decisions/0004-versioned-canvas-schema.md)).
6. **UI** (`src/nodes`, `src/app`, `src/components`). React Flow nodes built from
   design-system primitives, with design tokens only ([DESIGN.md](../DESIGN.md)).

## Automation

| Workflow            | Purpose                                                                                      |
| ------------------- | -------------------------------------------------------------------------------------------- |
| `ci.yml`            | lint, tokens, docs, typecheck, unit + golden tests, data gates (if data changed), build, e2e |
| `release-guard.yml` | Blocks version changes without a `release` label, report and human approval                  |
| `release.yml`       | Manual: generates the safety report and opens a `release` PR; tags after merge               |
| `patch-sync.yml`    | Daily: new patch → snapshot → gates → auto-merge PR, demotion, or issue                      |
| `health.yml`        | Weekly smoke test against the deployed site                                                  |
| `deploy.yml`        | `main` → GitHub Pages                                                                        |
| Dependabot          | Minor/patch updates auto-merge on green CI                                                   |

Human touchpoints: approving `release` PRs, and product decisions such as new effect
primitives or expanding the modeled roster.
