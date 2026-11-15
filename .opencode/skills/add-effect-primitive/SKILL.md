---

name: add-effect-primitive
description: Process for proposing a new engine effect primitive in lol-stats-flow when a champion/item mechanic cannot be expressed with the fixed set (Hit, OnHit, DoT, PercentHp, Execute, Amplifier, StatModifier, StackCounter, ResistReduction, Spellblade, Active). Use when a binding needs a mechanic the engine cannot express.
---

# Add an effect primitive (human decision)

The primitive set is fixed by
[ADR 0002](../../../docs/decisions/0002-formula-compiler-and-fixed-primitives.md).
**An agent never adds one on its own initiative.**

## Steps

1. **Prove the need.** Try to express the mechanic with the existing `PassiveTriggerApi`
   (`scheduleDot`, `scheduleBonusHit`, `addResistShred`, `armAmplifier`, buff counters,
   spellblade). Most "new" mechanics fit in these.
2. If it really doesn't fit, write `docs/decisions/NNNN-primitive-<name>.md` with status
   **Proposed**. Include:
   - the mechanic and the wiki source;
   - why the existing primitives fail;
   - the proposed type in `effects/types.ts` and where it sits in the `sim/simulate.ts`
     order of operations;
   - the test plan.
3. Open a PR containing only the ADR, labelled `needs-human`, and stop.
4. Once the human accepts it:
   - add the type to `effects/types.ts` and wire it into `sim/simulate.ts`;
   - add unit tests in `effects/primitives.test.ts` and `sim/simulate.test.ts`, covering
     ordering against existing primitives (DoT interleaving, %HP at resolve time);
   - update ADR 0002's list and `src/engine/AGENTS.md`;
   - continue with `add-champion-binding`.
