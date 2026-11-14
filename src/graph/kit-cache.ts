import type { Snapshot } from "@/data/schema"
import { buildKit, type Kit } from "@/engine"
import { resolveItemSlots } from "./item-rules"
import type { AbilitySlotWithRank, ItemSet } from "./types"

const RANK_SLOTS: readonly AbilitySlotWithRank[] = ["Q", "W", "E", "R"]
const CACHE_LIMIT = 200
const cache = new Map<string, Kit>()

function cacheKey(patch: string, championId: string, level: number, itemSet: ItemSet): string {
  const items = itemSet.items.join(",")
  const ranks = RANK_SLOTS.map((slot) => `${slot}:${itemSet.rankOverrides[slot] ?? ""}`).join(",")
  return `${patch}|${championId}|${level}|${items}|${ranks}`
}

/** Builds (or returns the memoized) `Kit` for one itemSet, keyed by every
 * input that can change its output: championId, level, item slots, rank
 * overrides, and the snapshot's patch (plan §5: "itemSet → Kit via
 * `buildKit`, memo by championId+level+items+ranks+snapshot patch").
 *
 * `buildKit` itself defaults any slot missing from `rankOverrides` to the
 * plan's level-appropriate rank (standard max order, R at 6/11/16) — the
 * itemSet's own explicit `rankOverrides` (set from the combo palette's rank
 * control) still win per-slot on top of that, passed straight through. */
export function getOrBuildKit(
  snapshot: Snapshot,
  championId: string,
  level: number,
  itemSet: ItemSet,
): Kit | undefined {
  const champion = snapshot.champions.find((c) => c.id === championId)
  if (champion === undefined || !champion.modeled) {
    return undefined
  }

  const key = cacheKey(snapshot.meta.patch, championId, level, itemSet)
  const cached = cache.get(key)
  if (cached !== undefined) {
    return cached
  }

  const equippedItems = resolveItemSlots(itemSet.items, snapshot.items)
  const kit = buildKit(snapshot, {
    championId,
    level,
    items: equippedItems.map((item) => item.name),
    rankOverrides: itemSet.rankOverrides,
  })

  if (cache.size >= CACHE_LIMIT) {
    const oldestKey = cache.keys().next().value
    if (oldestKey !== undefined) {
      cache.delete(oldestKey)
    }
  }
  cache.set(key, kit)
  return kit
}
