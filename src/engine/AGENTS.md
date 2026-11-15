# src/engine - rules

Pure TypeScript damage engine. Public API is `index.ts`; nothing outside `src/engine`
imports deeper paths except tests.

## Invariants

- No React, DOM, `Date.now()`, randomness or I/O. Same input → same output.
  Crit is chosen per combo step (`forceCrit`), never rolled.
- Only `../data/snapshot-schema` types may be imported from outside the engine.
- Formula math comes from compiling CDragon `mSpellCalculations` (`formula/compile.ts`).
  Unknown part kinds throw `FormulaCompileError` - never silently return 0.
- Effect primitives in `effects/types.ts` are a **fixed set**
  ([ADR 0002](../../docs/decisions/0002-formula-compiler-and-fixed-primitives.md)).
  Adding one is a product decision - see the `add-effect-primitive` skill and ask the human.
- Order of operations lives only in `sim/simulate.ts`:
  raw → crit → attacker amplifiers → target resist reduction → penetration → mitigation →
  HP → post-hit triggers → schedule DoTs. %current/missing HP reads target state at
  resolve time, including DoT ticks.

## Layout

- `stats/` base + growth + items → `ResolvedStats`.
- `formula/` CDragon formula tree → `(ctx) => number`.
- `mitigation/` resist / pen / lethality math.
- `sim/` event queue; `types.ts` defines `Kit`, `ComboAction`, `PassiveRule`, `DamageInstance`.
- `bindings/<champion>.ts` build a `Kit` per modeled champion; `bindings/items.ts` holds
  item passives/actives. Registered in `kit.ts` (`CHAMPION_BUILDERS`, `MELEE_CHAMPION_IDS`).
- The modeled roster is also declared in `scripts/data/normalize/modeled-roster.ts`.

## Tests (two kinds of golden, both required for each modeled entity)

- `__golden__/pinned/<x>.test.ts` - hand-verified against the wiki on a **frozen** patch
  fixture (`__golden__/fixtures/<patch>/`). Catches shared misunderstandings.
- `__golden__/reference/<x>.test.ts` - recomputes the expected values from the
  **current** snapshot with an independent evaluator. Survives balance patches and catches
  compiler or structural regressions. Runs as a patch-sync gate.
- `__golden__/coverage.test.ts` requires 100% of damage-bearing calcs to be bound for
  modeled champions.
- Never edit fixtures or expected numbers just to make a test pass. If a pinned value
  changes, cite the source (wiki URL + date) in the test comment.

Playbook: [`add-champion-binding`](../../.opencode/skills/add-champion-binding/SKILL.md).
