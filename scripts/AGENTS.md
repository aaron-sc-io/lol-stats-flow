# scripts - rules

Node scripts run with `tsx`, typechecked by `tsconfig.node.json`. They must not import
browser-only modules.

## scripts/data - snapshot pipeline

`sync.ts` = `fetch.ts` (DDragon + CDragon, cached in `.cache/`, retries in `http.ts`) →
`normalize.ts` (Zod-validated) → writes `data/snapshots/<patch>/` + `data/current.json`.
`diff.ts` and `coverage.ts` produce the reports included in patch-sync PRs.

- **`data/` is written only by this pipeline.** Never hand-edit snapshot JSON. Fix the
  normalizer and re-run `npm run data:sync -- --patch <p>`. The one exception is
  `data/demotions.json`, a decision ledger: delete a record from it to reinstate a fixed
  entity.
- Unknown CDragon formula parts and hashed keys are preserved, never dropped and never
  crash the pipeline. Add names to `normalize/hash-resolver.ts`.
- The modeled roster is `normalize/modeled-roster.ts`; keep it in sync with
  `src/engine/kit.ts`.
- Tests use trimmed fixtures in `scripts/data/__fixtures__/`; no network access in tests.

## scripts/gates - patch-sync gates

`run-gates.ts` runs schema → structural → coverage → size → golden.

- `demote.ts` flips failing modeled entities to `modeled: false` (recorded in
  `data/demotions.json`); `patch-sync-run.ts` orchestrates it all for
  `.github/workflows/patch-sync.yml`.
- `sync-state.ts` tracks consecutive fetch failures on the orphan `patch-sync-state` branch.
- Gate semantics: gates catch **structural** regressions, not balance changes. Never weaken
  a gate to get a patch through; demote, or fix the binding.
- Resolving `patch-sync-*` issues:
  [`resolve-patch-sync-issue`](../.opencode/skills/resolve-patch-sync-issue/SKILL.md).

## scripts/release - version safety report

`report.ts` builds `docs/releases/v<version>.md` (see
[docs/releases/README.md](../docs/releases/README.md)). Used by
`.github/workflows/release.yml` and the
[`cut-release`](../.opencode/skills/cut-release/SKILL.md) skill. Agents must never bump the
version outside this flow.

## Root scripts

`lint-tokens.ts` (design-token lint), `lint-docs.ts` (doc links, AGENTS coverage, skill
frontmatter), `engine-demo.ts` (manual engine smoke).
