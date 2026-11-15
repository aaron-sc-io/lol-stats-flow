---

name: resolve-patch-sync-issue
description: Triage and fix GitHub issues opened by lol-stats-flow automation - labels patch-sync-failure, patch-sync-demotion, patch-sync-flaky, health-check-failure. Use when asked to look at a patch-sync or health issue, a failed patch-sync run, or demoted champions/items.
---

# Resolve automation issues

Start by reading the issue body; it has the gate report. `gh issue view <n>` then
`gh run view <run-id> --log-failed`.

## patch-sync-flaky

The CDragon/DDragon fetch failed 3 or more times in a row.

1. Check the source by hand: `curl -I https://raw.communitydragon.org/latest/`.
2. If the source is down, comment and leave the issue open; the next successful run
   resets the counter (`scripts/gates/sync-state.ts`).
3. If the URL layout changed, fix `scripts/data/cdragon-client.ts` or `ddragon-client.ts`
   and test with `npm run data:sync -- --patch latest`.

## patch-sync-failure (gates failed, nothing demotable; main is unchanged)

1. Reproduce: `npm run data:sync -- --patch <p>`, then
   `npm run data:gates -- --patch <p>`.
2. Read `data/snapshots/<p>/gate-report.md`:
   - **schema**: the CDragon shape changed. Fix `scripts/data/normalize/*` (preserve
     unknowns) or update the Zod schema; a breaking change bumps `SNAPSHOT_SCHEMA_VERSION`.
   - **structural / coverage**: a bound calc became `unknown` or disappeared. Teach the
     formula compiler or normalizer the new part kind or hash name.
   - **size**: the snapshot grew past its budget. Find out why before raising the limit.
   - **golden**: a reference evaluator disagrees with the engine, which points to a real
     engine bug or a reworked mechanic (follow `add-champion-binding`).
3. Open a PR with the fix **and** the regenerated snapshot from the pipeline, and
   reference the issue. Never weaken a gate or hand-edit `data/`.

## patch-sync-demotion (site advanced; some entities are now unmodeled)

Follow the "Resolving a demotion" section of `add-champion-binding`. Close the issue once
the entity is modeled again.

## health-check-failure (the deployed site is broken)

1. `npm run test:health` reproduces it against production.
2. Compare with `npm run build && npm run preview` locally. Check the latest deploy run
   and whether it's a base-path or asset issue.
3. Fix forward with a PR. If `main` is broken, revert the culprit commit (a new commit,
   never a force-push).
