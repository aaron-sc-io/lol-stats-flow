# Roadmap

Distilled from the original build plan (phases 0-6 completed 2026-11-14, released as
v0.2.0). Open work is listed below; agents may add items as they find them.

## History

| Phase                 | Delivered                                                                                         | Acceptance evidence                                   |
| --------------------- | ------------------------------------------------------------------------------------------------- | ----------------------------------------------------- |
| 0 Bootstrap           | Vite/React/TS strict, Biome, Vitest, Playwright, CI, Pages deploy                                 | CI green, site live                                   |
| 1 Data pipeline       | fetch/normalize/diff/coverage, Zod snapshot, 16.22 snapshot                                       | `scripts/data/**` tests, schema gate                  |
| 2 Engine              | stats, mitigation, formula compiler, primitives, event-queue sim, 5 champions + 13 items          | `src/engine/**` unit + golden tests, 100% coverage    |
| 3 Graph & nodes       | store, typed connections, derived selectors, nodes, orphaned steps                                | `tests/e2e/phase3.spec.ts`                            |
| 4 UI/visual           | HoverPicker, roster/item pickers, scaling champion node, charts, highlight path, comparison table | `tests/e2e/visual.spec.ts`, axe, token lint           |
| 5 Persistence         | autosave, drawer, import/export, share URL, undo/redo, migrations, patch pin                      | `tests/e2e/persistence.spec.ts`, `migrations.test.ts` |
| 6 Automation          | patch-sync gates, auto-merge, demotion, flaky tolerance, health check                             | `scripts/gates/**`, workflows                         |
| 7 Agentic maintenance | AGENTS.md tree, ADRs, skills, `just verify`, doc lint, human-gated releases                       | `npm run lint:docs`, `release-guard.yml`              |

## Open

- **Expand the modeled roster.** Each champion follows the `add-champion-binding` skill.
  Needs a human decision only if it requires a new effect primitive.
- **Automatic branching/permutation** of item sets (ADR 0007): not started; the model
  allows it.
- **Golden-test blind spot**: a misunderstanding shared by the binding and the reference
  evaluator isn't caught automatically. Pinned suites mitigate it, so refresh them when
  a champion is reworked.
- Remove the inert `.github/renovate.json` if the Renovate app is never installed.
