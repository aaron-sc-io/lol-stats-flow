import { readFileSync } from "node:fs"
import { join } from "node:path"
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

/** Entities auto-demoted by `scripts/gates/demote.ts` (plan §3.3.3, Phase 6)
 * carry `modeled: false` going forward in the committed snapshot — this
 * golden suite treats `data/demotions.json` as the authority on "should
 * still be modeled", not the Phase 1 roster constants above (which only say
 * "would be modeled absent a demotion"). A demoted entity is exempted from
 * the "builds a working Kit" assertion rather than failing the suite, so
 * the gate orchestrator's demotion-then-regate loop can actually converge. */
function demotedIds(): ReadonlySet<string> {
  try {
    const raw = readFileSync(join(process.cwd(), "data", "demotions.json"), "utf8")
    const file = JSON.parse(raw) as { demotions: readonly { id: string }[] }
    return new Set(file.demotions.map((d) => d.id))
  } catch {
    return new Set()
  }
}

/** Coverage gate (Phase 2 AC): every damage-bearing calculation of the 5
 * modeled champions compiles and is bound into at least one `ComboAction`.
 * This is the engine-side half of the plan's coverage requirement — the
 * data-side half (`npm run data:coverage`) reports 0 unknown FormulaNode
 * parts / unresolved hashes for the same roster (see COVERAGE.md). */
describe("Coverage gate — 100% of modeled champions build a working Kit", () => {
  it(`Given all ${MODELED_CHAMPION_KEYS.size} modeled champion keys, when each is looked up in the snapshot, then every non-demoted one is marked modeled and builds a Kit with 1+ actions`, () => {
    const demoted = demotedIds()
    const modeledChampions = snapshot.champions.filter((c) => MODELED_CHAMPION_KEYS.has(c.key))
    expect(modeledChampions).toHaveLength(MODELED_CHAMPION_KEYS.size)
    for (const champion of modeledChampions) {
      if (demoted.has(champion.id)) {
        expect(champion.modeled).toBe(false)
        continue
      }
      expect(champion.modeled).toBe(true)
      const kit = buildKit(snapshot, { championId: champion.id, level: 11, items: [] })
      expect(kit.actions.length).toBeGreaterThan(0)
    }
  })

  it(`Given all ${MODELED_ITEM_IDS.size} modeled item ids, when each is looked up in the snapshot, then every non-demoted one is marked modeled and has resolved stats or a bound passive/active`, () => {
    const demoted = demotedIds()
    const modeledItems = snapshot.items.filter((i) => MODELED_ITEM_IDS.has(i.id))
    expect(modeledItems).toHaveLength(MODELED_ITEM_IDS.size)
    for (const item of modeledItems) {
      if (demoted.has(String(item.id))) {
        expect(item.modeled).toBe(false)
        continue
      }
      expect(item.modeled).toBe(true)
      const hasStatsOrMechanic =
        Object.keys(item.stats).length > 0 || item.passivesAndActives.length > 0
      expect(hasStatsOrMechanic).toBe(true)
    }
  })

  it("Given every non-demoted modeled champion's kit, when every bound action is read, then none are marked `modeled: false` (no auto-demoted/unmodeled actions slipped through)", () => {
    const demoted = demotedIds()
    for (const key of MODELED_CHAMPION_KEYS) {
      const champion = snapshot.champions.find((c) => c.key === key)
      if (champion === undefined) throw new Error(`fixture missing champion key ${key}`)
      if (demoted.has(champion.id)) {
        continue
      }
      const kit = buildKit(snapshot, { championId: champion.id, level: 11, items: [] })
      expect(kit.actions.every((a) => a.modeled)).toBe(true)
    }
  })
})
