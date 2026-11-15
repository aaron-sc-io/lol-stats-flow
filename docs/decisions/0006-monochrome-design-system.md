# 0006 - Monochrome, token-only design system

**Context.** The user asked for a sleek grey/black/white, professional UI with no library
default looks.

**Decision.** All raw values live in `src/styles/tokens.css`, and components use semantic
aliases. The only colors are the damage-type data colors and `--danger`. React Flow,
Recharts and native controls are fully restyled. Series are distinguished by stroke
pattern and marker shape, not color. The full spec is in [DESIGN.md](../../DESIGN.md).

**Consequences.** `npm run lint:tokens` enforces the token rule. `DESIGN.md` changes in
the same PR as any visual-rule change. axe must report 0 serious or critical violations.
