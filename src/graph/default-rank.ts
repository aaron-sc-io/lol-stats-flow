/**
 * Level-based default ability rank (plan D7/§1 "ranks default from standard
 * max order ... R at 6/11/16"). `buildKit`'s bindings only default a missing
 * `rankOverrides[slot]` to the ability's *max* rank (see
 * `src/engine/bindings/*.ts`'s `ranks.Q ?? q.maxRank`) — they don't read
 * champion level at all. The graph layer closes that gap itself: every kit
 * build passes an explicit `rankOverrides` computed here, so the level
 * slider actually changes simulated damage, and an itemSet's own
 * `rankOverrides` (set from the combo palette's rank control) still wins
 * per-slot on top of it.
 */
export function defaultRankForLevel(
  slot: "Q" | "W" | "E" | "R",
  level: number,
  maxRank: number,
): number {
  if (maxRank <= 0) {
    return 0
  }
  if (slot === "R") {
    const ultRank = level >= 16 ? 3 : level >= 11 ? 2 : level >= 6 ? 1 : 0
    return Math.max(1, Math.min(maxRank, ultRank || 1))
  }
  // Standard max-first order: a basic ability gains a rank roughly every
  // other level once picked, reaching max rank near level `maxRank * 2`.
  const rank = Math.ceil(Math.min(level, maxRank * 2) / 2)
  return Math.max(1, Math.min(maxRank, rank))
}
