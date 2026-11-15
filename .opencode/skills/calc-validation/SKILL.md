---

name: calc-validation
description: Write expected-vs-actual validation tests for lol-stats-flow damage calculations — prove that an item, ability, passive, penetration/crit/amp mechanic, or full combo is computed correctly by comparing the engine (buildKit + simulate) against an independent hand-math oracle built from raw snapshot JSON. Use whenever the user asks to validate, verify, sanity-check, or "do the math" on a champion's damage, an item's effect (crit, armor/magic pen, lethality, amps, on-hit, shred), a combo, or asks whether "X actually applies"/"X actually modifies Y".
---

# Calculation validation tests (lol-stats-flow)

Goal: show that the calculator is right by checking it against math that does **not**
share its code. Every claim ends up as a row in an expected-vs-actual table and a
Vitest assertion.

Reference implementation:
`src/engine/__golden__/reference/yasuo-damage-validation.test.ts`. Copy its
structure.

## 1. Map out the mechanics before writing anything

Read these (use `codegraph_explore` first):

- The champion binding: `src/engine/bindings/<champ>.ts`. Note the action ids
  (e.g. `Q`, `Q-empowered`, `AA-crit`, `E-stack2`), what each component computes,
  `canCrit`, `forceCrit`, `bonusArmorPenPercent`, and any `passiveTriggers` /
  buff counters.
- `src/engine/sim/simulate.ts`, `resolveInstance` / `fireAction`. This is the
  order things happen in: raw → crit → amplifiers → reductions → pen →
  mitigation.
- `src/engine/stats/stats-at.ts`. Shows how item stats are summed and how
  percent pen stacks (`1 - Π(1-p)`).
- `src/engine/mitigation/index.ts`. The resistance and mitigation formulas.
- `src/engine/bindings/items.ts`. Shows which item passives are actually
  modeled. If an item isn't handled there, only its raw `stats` apply.
- The raw data in `data/snapshots/<patch>/champions.json` and `items.json`
  (patch from `data/current.json`). Dump the relevant champion, ability and item
  entries with a throwaway node script in the temp dir, then delete it.

Write down, for every mechanic under test, the exact snapshot field it comes
from (e.g. `criticalStrikeDamageBonus`, `armorPenetrationPercent`,
`RPercentArmorPen`). Flag anything that is `modeled: false` or has an
unimplemented passive. These caveats go in the final report.

## 2. Design the experiment

Each claim needs a **control** and a **treatment** that differ in exactly one
thing:

| Claim type                                         | Control                                       | Treatment                                                              |
| -------------------------------------------------- | --------------------------------------------- | ---------------------------------------------------------------------- |
| Item modifies a stat (crit dmg, pen, AP amp)       | no items / base set                           | same set + that item                                                   |
| Ability/buff changes later hits                    | combo without the ability                     | same combo with it inserted                                            |
| Buff only affects some hits                        | same hit before vs after the buff, in one sim | also compare a non-qualifying hit after the buff (should be unchanged) |
| Stacking/interaction (pen × bonus pen, amp × crit) | each item/buff alone                          | both together                                                          |
| Damage-type scoping                                | physical hit with the pen item                | magic/true hit with the same item (should be unaffected)               |

Pick a target that exposes the mechanic:

- Bonus-only pen or reduction: set nonzero `bonusArmor` / `bonusMagicResist`.
- %HP effects: set the HP state on purpose.
- Everything else: use a huge `maxHp` so nothing dies mid-combo and every hit
  resolves.

Use non-round armor/MR values (e.g. 100 total, 60 bonus) so a mix-up between
base and bonus resist shows up as a different number. Pin `level` and explicit
`rankOverrides` so default rank progression can't shift results.

Item sets: one per variable, plus at least one combined set. Respect unique
groups (e.g. Last Whisper items can't stack).

## 3. Build the oracle (the "separate space")

Rules:

- **Allowed imports:** `node:fs`, `node:path`, `vitest`, and on the actual side
  only `buildKit`, `simulate`, the sim types, and `loadSnapshotFixture`.
- **Never import:** `stats/`, `formula/`, `mitigation/`, or a binding.
  Re-deriving numbers through the engine's own helpers makes the test a
  tautology.
- Read raw JSON with `readFileSync`. Type only the fields you use.
- Re-implement each formula from first principles in the test, and comment the
  formula next to the code:
  - growth: `(L-1)·(0.7025 + 0.0175·(L-1))`
  - base / bonus / total AD and AP
  - crit multiplier: champion `critDamageMultiplier` + item bonuses
  - percent pen: `1 - Π(1-p)`
  - lethality: `L·(0.6 + 0.4·level/18)`
  - armor split: `base·(1-p) + bonus·(1-p)·(1-bonusPen)`, minus flat pen,
    clamped at 0
  - mitigation: `100/(100+R)` when R ≥ 0, `2 - 100/(100-R)` when R < 0
- Model state the same way the game does. Example: a `rCast` flag flips after R,
  so only later crits get the bonus pen.
- Use `need(value, label)` helpers that throw on missing data. Biome forbids `!`.
- Cross-check at least one key number with a hard-coded literal (e.g.
  `100/(100 + 40 + 60·0.4)`) so the oracle itself is checked.

## 4. Compare and tabulate

- Run every set × combo through `oracle()` and `runEngine()`. Push one row per
  step plus a `TOTAL` row with: `set, combo, step, expected, actual, delta, ok`.
- `console.table(rows)` at module level. That is the deliverable table.
- `it.each(rows)` asserts every row (`toBeCloseTo(expected, 4)`).
- Add targeted `describe` blocks named after each user claim ("(a) IE modifies
  crit", …). Assert the _property_, not just the number:
  - ratios (crit ÷ non-crit = multiplier)
  - inequalities (after-buff > before-buff)
  - invariance (magic damage unchanged by armor pen, non-crit unchanged by a
    crit-only buff)
  - the exact closed-form value
- Snapshot values are float32 (`0.30000001`). Compare literals at 4 decimal
  places. Oracle-vs-engine rows stay much tighter (<1e-6).

## 5. Place, run, verify

- Path: `src/engine/__golden__/reference/<champ-or-topic>-<mechanic>-validation.test.ts`
  for tests that should hold on any patch (read `data/current.json`). If the test
  asserts hand-verified absolute numbers for one patch, put it under `pinned/`
  and use `loadPinnedSnapshotFixture(patch)`.
- Run each once:
  - `npx vitest run <file>`
  - `npx biome check --write <file>`
  - `npx tsc -b`
- When a row fails, work out whether the oracle is wrong (re-read the snapshot
  field or formula) or the engine is wrong. Never tweak the oracle to match
  the engine without a cited reason. Engine bugs are findings: report them,
  and fix them only if asked.
- Delete any temp inspection scripts.

## 6. Report

Start with the verdict (each claim validated or not). Then include:

1. The setup (level, ranks, target, combos, item sets).
2. A condensed expected/actual/Δ table: combo totals plus one key row per claim.
3. Caveats: unmodeled passives, `modeled: false` items whose stats still apply,
   and any formula taken from snapshot data rather than in-game observation.
