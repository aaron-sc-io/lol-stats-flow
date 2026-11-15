# 0003 - Store holds canonical input; every number is derived

**Context.** Changing one item has to update every downstream combo, chart and table live,
undo has to be meaningful, and saved canvases have to stay small.

**Decision.** The Zustand store holds only user input: node and edge typing and
positions, champion/level/item sets, combo steps, targets and graph options. Kits, sim
results, chart series and comparison rows are computed by memoized caches
(`kit-cache`, `sim-cache`, `chart-points`, `comparison-row`). zundo history tracks
`toCanonicalGraph()` only, and bursts of changes are coalesced into one entry.

**Consequences.** Never write a derived number into the store or into node `data`.
Persistence serializes the same canonical projection that undo tracks. Removing an
upstream source orphans dependent steps instead of deleting them.
