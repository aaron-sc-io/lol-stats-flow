# 0002 - Compile CDragon formulas; bind to a fixed effect-primitive set

**Context.** Ability math has to follow Riot's patches without anyone parsing tooltip
text.

**Decision.** `src/engine/formula` compiles CDragon `GameCalculation` trees into pure
functions. Unknown part kinds are compile errors (reported as coverage), never a silent 0.
Per-champion and per-item **bindings** (`src/engine/bindings`) map those compiled formulas
onto a **fixed set of effect primitives**: Hit, OnHit, DoT, PercentHp, Execute,
Amplifier, StatModifier, StackCounter, ResistReduction, Spellblade and Active. Each is
expressed through `effects/types.ts` and the `Kit`/`PassiveRule` API. A single
deterministic event queue (`sim/simulate.ts`) owns the order of operations.

**Consequences.** Balance patches flow through automatically, and the reference golden
tests recompute expected values from the snapshot. A _new kind_ of mechanic can't be
expressed until someone adds a primitive. That is a product decision for the human, not
something an agent should do on its own initiative (see the `add-effect-primitive` skill).
