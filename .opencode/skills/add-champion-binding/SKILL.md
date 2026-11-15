---

name: add-champion-binding
description: Add or update an engine binding for a League champion or item in lol-stats-flow (make it "modeled"). Use when expanding the modeled roster, fixing wrong damage numbers for a modeled champion/item, rebinding after a patch changed a calculation, or resolving a demotion.
---

# Add / update a champion or item binding

Read `src/engine/AGENTS.md` first.

## Steps

1. **Check the data.** In `data/snapshots/<current>/champions.json` (or `items.json`),
   read the entity's `abilities[slot].calculations` and `dataValues`. Run
   `npm run data:coverage` to see which calcs are damage-bearing and unbound.
2. **Can the fixed primitives express it?** (Hit, OnHit, DoT, PercentHp, Execute,
   Amplifier, StatModifier, StackCounter, ResistReduction, Spellblade, Active, via
   `Kit.actions` components and `PassiveRule`s.) If not, **stop** and use
   `add-effect-primitive`, which needs the human.
3. **Register it in the roster:**
   - `scripts/data/normalize/modeled-roster.ts` (champion `key` or item id);
   - for a champion: `src/engine/kit.ts` `CHAMPION_BUILDERS` (and `MELEE_CHAMPION_IDS`
     if it's melee);
   - then re-run `npm run data:sync -- --patch <current>` so `modeled: true` is written.
     Never hand-edit `data/`.
4. **Write the binding.**
   - Champions: `src/engine/bindings/<name>.ts` exporting `build<Name>Kit`. Copy the
     structure of a similar existing champion: Garen for an execute, Brand for a DoT,
     Vayne for every-Nth/on-hit.
   - Items: add to `bindings/items.ts`.
   - Use `bindings/helpers.ts` and `compileCalculation`; don't hand-code numbers that exist
     in `dataValues`. When the data has no calc, document the override in a comment.
5. **Tests (both are required):**
   - `src/engine/__golden__/reference/<name>.test.ts`: expected values recomputed from the
     current snapshot's dataValues with an independent formula.
   - `src/engine/__golden__/pinned/<name>.test.ts`: values hand-verified against
     `https://wiki.leagueoflegends.com/en-us/<Name>` on the frozen fixture patch. Cite the
     URL and retrieval date. If the entity is missing from `__golden__/fixtures/<patch>/`,
     extract it from the snapshot. That is the only time fixture files are added to; never
     change existing values.
   - `__golden__/coverage.test.ts` must stay at 100% for modeled champions.
6. **UI.** The roster and item pickers read `modeled` automatically. Check the palette in
   the browser (`npm run dev`).
7. Run `just verify`. Commit as `feat(engine): model <Name>`.

## Resolving a demotion

A patch-sync demotion means the gates failed for an entity, which was then set to
`modeled: false` in `data/demotions.json`. Find the failing gate in
`data/snapshots/<patch>/gate-report.md`, fix the binding or compiler, then reinstate the
entity:

1. Delete its record from `data/demotions.json`. This file is a decision ledger and the
   one `data/` file that may be edited directly; there's no reinstate command.
2. Re-run `npm run data:sync -- --patch <p>` and `npm run data:gates -- --patch <p>`.

Never weaken a gate.
