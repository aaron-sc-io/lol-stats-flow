import { describe, expect, it } from "vitest"
import { buildKit } from "../../kit"
import { simulate } from "../../sim/simulate"
import { loadPinnedSnapshotFixture } from "../../test-support/load-snapshot"

/** Pinned to patch 16.22.1 (plan §3.3 item 2) — see `pinned/darius.test.ts`
 * module doc comment for why this suite loads the frozen fixture instead of
 * `data/current.json`. */
const PINNED_PATCH = "16.22.1"
const snapshot = loadPinnedSnapshotFixture(PINNED_PATCH)
const dummy = (maxHp: number, armor: number, magicResist: number) => ({
  id: "dummy",
  name: "Dummy",
  maxHp,
  armor,
  magicResist,
  bonusHp: 0,
})

/** Golden tests for Yasuo, hand-verified against the League of Legends Wiki
 * (wiki.leagueoflegends.com/en-us/Yasuo, Steel Tempest / Sweeping Blade
 * tooltips, retrieved 2026-11-14 — base values match patch 16.22's
 * snapshot exactly: 60 base AD +2.5/lvl, Q 20/45/70/95/120 (+100% total
 * AD)). These lock in the rank→dataValue indexing fix (CDragon arrays are
 * `[rank0placeholder, rank1, ..., rankMax, ...]`, NOT `[rank1, rank2, ...]`)
 * discovered while writing this test — see compile.ts's `dataValueAt` doc
 * comment. */
describe("Yasuo golden (pinned 16.22.1) — level 1, rank 1, no items", () => {
  const kit = buildKit(snapshot, {
    championId: "Yasuo",
    level: 1,
    items: [],
    rankOverrides: { Q: 1, E: 1, R: 1 },
  })

  it("Q (Steel Tempest) rank 1: wiki = 20 (+100% total AD); level-1 total AD = 60 base → 20 + 60 = 80 raw", () => {
    const result = simulate({
      steps: [{ id: "s", sourceId: "Yasuo", actionId: "Q" }],
      kits: { Yasuo: kit },
      target: dummy(2000, 0, 0),
    })
    expect(result.instances[0]?.raw).toBeCloseTo(80)
  })

  it("AA (basic attack) at level 1: raw equals total AD (60, no items)", () => {
    const result = simulate({
      steps: [{ id: "s", sourceId: "Yasuo", actionId: "AA" }],
      kits: { Yasuo: kit },
      target: dummy(2000, 0, 0),
    })
    expect(result.instances[0]?.raw).toBeCloseTo(60)
  })
})

describe("Yasuo golden (pinned 16.22.1) — level 18, rank 5, vs 100 armor / 100 MR target", () => {
  const kit = buildKit(snapshot, {
    championId: "Yasuo",
    level: 18,
    items: [],
    rankOverrides: { Q: 5, E: 5, R: 3 },
  })
  // Level 18 total AD = 60 + 2.5*17 = 102.5 (growthMultiplier(18) = 17 exactly).
  const totalAD = 60 + 2.5 * 17

  it("Q rank 5: wiki = 120 (+100% total AD) — raw = 120 + totalAD, mitigated by 100 armor (÷2)", () => {
    const result = simulate({
      steps: [{ id: "s", sourceId: "Yasuo", actionId: "Q" }],
      kits: { Yasuo: kit },
      target: dummy(2000, 100, 100),
    })
    const expectedRaw = 120 + totalAD
    expect(result.instances[0]?.raw).toBeCloseTo(expectedRaw)
    expect(result.instances[0]?.mitigated).toBeCloseTo(expectedRaw / 2)
  })

  it("ComboStep.rankOverride is honored at fire time: a rank-5-kit Q step fired with rankOverride:1 uses rank-1's dataValues (20, not 120)", () => {
    const atKitRank = simulate({
      steps: [{ id: "s", sourceId: "Yasuo", actionId: "Q" }],
      kits: { Yasuo: kit },
      target: dummy(2000, 0, 0),
    })
    const overridden = simulate({
      steps: [{ id: "s", sourceId: "Yasuo", actionId: "Q", rankOverride: 1 }],
      kits: { Yasuo: kit },
      target: dummy(2000, 0, 0),
    })
    expect(atKitRank.instances[0]?.raw).toBeCloseTo(120 + totalAD)
    expect(overridden.instances[0]?.raw).toBeCloseTo(20 + totalAD)
  })

  it('E (Sweeping Blade) rank 5 is magic damage (verified via wiki — deals magic, not physical, despite scaling off AD): raw = 130 + 20% bonus AD + 60% AP; with no items, bonus AD is 0 (per wiki\'s Attack_damage page: "bonus attack damage can be gained from any source other than levels" — level growth counts as base, not bonus), so raw = 130 flat', () => {
    const result = simulate({
      steps: [{ id: "s", sourceId: "Yasuo", actionId: "E" }],
      kits: { Yasuo: kit },
      target: dummy(2000, 100, 100),
    })
    expect(result.instances[0]?.damageType).toBe("magic")
    expect(result.instances[0]?.raw).toBeCloseTo(130)
    expect(result.instances[0]?.mitigated).toBeCloseTo(65)
  })

  it("after Last Breath (R), crits (AA-crit, crit Q) ignore 60% BONUS armor (16.22 tooltip: RPercentArmorPen = 60); non-crits and pre-R crits do not", () => {
    // 200 armor, 150 of it bonus → post-R crits see 50 + 150 * 0.4 = 110.
    const result = simulate({
      steps: [
        { id: "aa-crit-before", sourceId: "Yasuo", actionId: "AA-crit" },
        { id: "r", sourceId: "Yasuo", actionId: "R" },
        { id: "aa-crit", sourceId: "Yasuo", actionId: "AA-crit" },
        { id: "q-crit", sourceId: "Yasuo", actionId: "Q-empowered" },
        { id: "aa", sourceId: "Yasuo", actionId: "AA" },
      ],
      kits: { Yasuo: kit },
      target: { ...dummy(100000, 200, 100), bonusArmor: 150 },
    })
    const byStep = (stepId: string) => result.instances.find((i) => i.stepId === stepId)
    const before = byStep("aa-crit-before")
    expect(before?.mitigated).toBeCloseTo((before?.raw ?? 0) / 3)
    expect(byStep("aa-crit")?.mitigated).toBeCloseTo((byStep("aa-crit")?.raw ?? 0) / 2.1)
    expect(byStep("q-crit")?.mitigated).toBeCloseTo((byStep("q-crit")?.raw ?? 0) / 2.1)
    const aa = byStep("aa")
    expect(aa?.mitigated).toBeCloseTo((aa?.raw ?? 0) / 3)
  })

  it("Last Breath's crit pen does nothing against a target with only base armor", () => {
    const result = simulate({
      steps: [
        { id: "r", sourceId: "Yasuo", actionId: "R" },
        { id: "aa-crit", sourceId: "Yasuo", actionId: "AA-crit" },
      ],
      kits: { Yasuo: kit },
      target: dummy(100000, 100, 100),
    })
    const crit = result.instances.find((i) => i.stepId === "aa-crit")
    expect(crit?.mitigated).toBeCloseTo((crit?.raw ?? 0) / 2)
  })
})
