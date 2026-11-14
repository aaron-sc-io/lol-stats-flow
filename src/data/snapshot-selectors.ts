import { type ChampionData, type ItemData, type Snapshot, SnapshotSchema } from "./schema"

/** Pure, synchronous core of the loader: given an already-loaded snapshot,
 * answers lookups. Split out from `loader.ts` so it can be unit-tested
 * against an in-memory fixture without touching Vite's `import.meta.glob`
 * lazy-loading machinery. */

export function findChampion(snapshot: Snapshot, id: string): ChampionData | undefined {
  return snapshot.champions.find((champion) => champion.id === id)
}

export function listChampions(snapshot: Snapshot): readonly ChampionData[] {
  return snapshot.champions
}

export function findItem(snapshot: Snapshot, id: number): ItemData | undefined {
  return snapshot.items.find((item) => item.id === id)
}

export function listItems(snapshot: Snapshot): readonly ItemData[] {
  return snapshot.items
}

/** Dev-only validation gate: re-parses the snapshot with Zod so a malformed
 * build-time artifact fails loudly during development instead of silently
 * misbehaving at runtime. Skipped in production builds to avoid paying the
 * parse cost on every page load. */
export function validateSnapshotInDev(snapshot: unknown, isDev: boolean): Snapshot {
  if (!isDev) {
    return snapshot as Snapshot
  }
  return SnapshotSchema.parse(snapshot)
}
