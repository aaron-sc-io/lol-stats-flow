# 0001 - Build-time snapshots from DDragon + CDragon

**Context.** The app needs champion and item stats, per-rank values and damage formulas.
DDragon has assets and versions but no formulas. CDragon game-bin JSON has
`mSpellCalculations`, but it's an unofficial source that sometimes has outages. Meraki was
rejected because it has been stale since 2025-04.

**Decision.** Fetch and normalize at **build time** into a versioned snapshot committed
under `data/snapshots/<patch>/`. At runtime the app loads only same-origin JSON; the
DDragon CDN is used for images only. The last 3 snapshots are kept for patch-pinned
canvases.

**Consequences.** CDragon outages never break the live site. Snapshot changes are
reviewed as PRs by the gates. `data/` must only be written by `scripts/data`.
