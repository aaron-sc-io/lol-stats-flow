import { describe, expect, it } from "vitest"
import { buildKit } from "../kit"
import { loadSnapshotFixture } from "../test-support/load-snapshot"

const snapshot = loadSnapshotFixture()

// Mirrors scripts/data/normalize/modeled-roster.ts (plan §1 "Chosen
// defaults" roster) — duplicated here rather than imported so this test
// stays inside the `src/` TS project boundary (scripts/ is a separate
// tsconfig project).
const MODELED_CHAMPION_KEYS: ReadonlySet<number> = new Set([157, 63, 67, 122, 86])
const MODELED_ITEM_IDS: ReadonlySet<number> = new Set([
  3031, 6673, 6653, 3153, 3036, 3071, 3078, 3057, 6672, 3089, 3135, 3152, 4633,
])

/** Coverage gate (Phase 2 AC): every damage-bearing calculation of the 5
 * modeled champions compiles and is bound into at least one `ComboAction`.
 * This is the engine-side half of the plan's coverage requirement — the
 * data-side half (`npm run data:coverage`) reports 0 unknown FormulaNode
 * parts / unresolved hashes for the same roster (see COVERAGE.md). */
describe("Coverage gate — 100% of modeled champions build a working Kit", () => {
  it(`Given all ${MODELED_CHAMPION_KEYS.size} modeled champion keys, when each is looked up in the snapshot, then every one is marked modeled and builds a Kit with 1+ actions`, () => {
    const modeledChampions = snapshot.champions.filter((c) => MODELED_CHAMPION_KEYS.has(c.key))
    expect(modeledChampions).toHaveLength(MODELED_CHAMPION_KEYS.size)
    for (const champion of modeledChampions) {
      expect(champion.modeled).toBe(true)
      const kit = buildKit(snapshot, { championId: champion.id, level: 11, items: [] })
      expect(kit.actions.length).toBeGreaterThan(0)
    }
  })

  it(`Given all ${MODELED_ITEM_IDS.size} modeled item ids, when each is looked up in the snapshot, then every one is marked modeled and has resolved stats or a bound passive/active`, () => {
    const modeledItems = snapshot.items.filter((i) => MODELED_ITEM_IDS.has(i.id))
    expect(modeledItems).toHaveLength(MODELED_ITEM_IDS.size)
    for (const item of modeledItems) {
      expect(item.modeled).toBe(true)
      const hasStatsOrMechanic =
        Object.keys(item.stats).length > 0 || item.passivesAndActives.length > 0
      expect(hasStatsOrMechanic).toBe(true)
    }
  })

  it("Given every modeled champion's kit, when every bound action is read, then none are marked `modeled: false` (no auto-demoted/unmodeled actions slipped through)", () => {
    for (const key of MODELED_CHAMPION_KEYS) {
      const champion = snapshot.champions.find((c) => c.key === key)
      if (champion === undefined) throw new Error(`fixture missing champion key ${key}`)
      const kit = buildKit(snapshot, { championId: champion.id, level: 11, items: [] })
      expect(kit.actions.every((a) => a.modeled)).toBe(true)
    }
  })
})
