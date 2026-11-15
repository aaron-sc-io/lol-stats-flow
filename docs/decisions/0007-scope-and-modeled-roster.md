# 0007 - Scope limits and the modeled roster

**Context.** Modeling every champion and every item mechanic doesn't scale, so v1 picks
champions and items that cover the full range of mechanics.

**Decision.**

- **Out of scope:** runes, the Riot match API, any server, summoner spells,
  champion-vs-champion (the target is a stat dummy), and attacker-side shields/healing.
- **Modeled champions:**
  - Yasuo: crit-scaling Q, stacks, the default champion.
  - Brand: burn DoT and stack detonation.
  - Vayne: on-hit, every-3rd-hit true damage, AA reset.
  - Darius: stacking bleed, R scaled by stacks.
  - Garen: %missing-HP execute.
- **Modeled items:** Infinity Edge, Immortal Shieldbow, Liandry's, BotRK, Lord Dominik's,
  Black Cleaver, Trinity Force, Sheen, Kraken Slayer, Rabadon's, Void Staff, Rocketbelt,
  Riftmaker.
- Unmodeled champions are shown but can't be selected. Unmodeled items contribute stats
  only and show a badge.
- Branching is manual, but the data model must not rule out automatic permutation later.

**Consequences.** Adding a champion or item follows the `add-champion-binding` skill
(roster in `scripts/data/normalize/modeled-roster.ts` + `src/engine/kit.ts`, bindings, and
pinned + reference golden tests). Expanding the scope list above is a product decision.
