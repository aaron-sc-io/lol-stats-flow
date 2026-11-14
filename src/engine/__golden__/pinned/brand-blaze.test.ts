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

/** Golden tests for Brand's passive, Blaze — hand-verified against
 * https://wiki.leagueoflegends.com/en-us/Brand (retrieved 2026-11-14,
 * "Template:Data Brand/Blaze"):
 *   - "Brand's abilities apply a stack of Ablaze to enemies hit for 4
 *     seconds, stacking up to 3 times and refreshing the duration of all
 *     stacks with each application."
 *   - "Ablaze: ... dealt magic damage equal to 2% of their maximum health
 *     over 4 seconds ... every 0.25 seconds."
 *   - "Upon applying 3 stacks of Ablaze ... dealt magic damage equal to
 *     6% – 12% (based on level) (+ 2% per 100 AP) of their maximum health"
 *     — matches the snapshot's `P.ExplosionDamage` calc exactly: interpolates
 *     6→12 across levels 1→18, +0.02 coefficient (per 1 AP, i.e. 2%/100AP),
 *     the whole sum scaled by a ×0.01 multiplier (the calc's own output is a
 *     *fraction* of max HP, e.g. 0.06 = 6%, not a flat number — must be
 *     multiplied by `target.maxHp`, never used as raw damage directly).
 *
 * The real game ticks each of the 3 Ablaze stacks' burns *independently*
 * ("each stack of Ablaze deals damage to the target individually ... even
 * if the duration of all stacks are refreshed") — this engine models the
 * burn as ONE merged, duration-refreshing DoT stream whose per-tick value
 * scales with the current stack count, the same simplification already used
 * for Darius's Hemorrhage bleed, to keep the event queue tractable. Total
 * damage output over a sustained burn is equivalent; only sub-tick timing
 * granularity differs from the true per-stack-independent model. */
describe("Brand golden (pinned 16.22.1) — Blaze passive (detonation + ablaze burn)", () => {
  it("Given 2 ablaze applications (Q then W), when simulated, then detonation does NOT fire (requires 3 stacks, not 2)", () => {
    const kit = buildKit(snapshot, { championId: "Brand", level: 9, items: [] })
    const result = simulate({
      steps: [
        { id: "q", sourceId: "Brand", actionId: "Q" },
        { id: "w", sourceId: "Brand", actionId: "W" },
      ],
      kits: { Brand: kit },
      target: dummy(2000, 0, 0),
    })
    expect(result.instances.some((i) => i.label === "Blaze detonation")).toBe(false)
  })

  it("Given 3 ablaze applications (Q, W, E), when simulated, then detonation fires on the 3rd hit for magic damage = ExplosionDamage(fraction) * target.maxHp", () => {
    const brand = snapshot.champions.find((c) => c.name === "Brand")
    if (brand === undefined) throw new Error("fixture missing")
    const kit = buildKit(snapshot, { championId: "Brand", level: 9, items: [] })
    const result = simulate({
      steps: [
        { id: "q", sourceId: "Brand", actionId: "Q" },
        { id: "w", sourceId: "Brand", actionId: "W" },
        { id: "e", sourceId: "Brand", actionId: "E" },
      ],
      kits: { Brand: kit },
      target: dummy(2000, 0, 0),
    })
    const detonation = result.instances.find((i) => i.label === "Blaze detonation")
    expect(detonation).toBeDefined()
    expect(detonation?.damageType).toBe("magic")
    // Reference-evaluator: recompute the fraction independently from the
    // byCharLevelInterpolation + statByCoefficient parts (level 9, 0 AP),
    // matching the wiki's "6% – 12% (based on level)" linear scaling.
    const t = (9 - 1) / (18 - 1)
    const fraction = (6 + t * (12 - 6)) * 0.01 // +0.02*AP term is 0 with no items
    expect(detonation?.raw).toBeCloseTo(fraction * 2000)
    // Sanity: detonation damage must be a meaningful fraction of a 2000 HP
    // target (not the un-multiplied ~0.09 fraction a unit bug would emit).
    expect(detonation?.raw).toBeGreaterThan(100)
  })

  it("Given a single ablaze application (Q), when simulated, then an Ablaze burn DoT ticks as magic damage (not absent)", () => {
    const kit = buildKit(snapshot, { championId: "Brand", level: 9, items: [] })
    const result = simulate({
      steps: [{ id: "q", sourceId: "Brand", actionId: "Q" }],
      kits: { Brand: kit },
      target: dummy(2000, 0, 0),
    })
    const burnTicks = result.instances.filter((i) => i.label === "Ablaze" && i.isTick)
    expect(burnTicks.length).toBeGreaterThan(0)
    expect(burnTicks.every((i) => i.damageType === "magic")).toBe(true)
  })

  it("Given a single ablaze application, when all its ticks resolve, then total burn damage ≈ 2% of target max HP over 4s (1 stack)", () => {
    const kit = buildKit(snapshot, { championId: "Brand", level: 9, items: [] })
    const result = simulate({
      steps: [{ id: "q", sourceId: "Brand", actionId: "Q" }],
      kits: { Brand: kit },
      target: dummy(2000, 0, 0),
    })
    const burnTicks = result.instances.filter((i) => i.label === "Ablaze" && i.isTick)
    const total = burnTicks.reduce((sum, i) => sum + i.raw, 0)
    expect(total).toBeCloseTo(0.02 * 2000, 0)
  })

  it("Given Q then W applied in quick succession, when simulated, then the burn DoT refreshes (one merged stream, not two parallel streams of ticks)", () => {
    const kit = buildKit(snapshot, { championId: "Brand", level: 9, items: [] })
    const result = simulate({
      steps: [
        { id: "q", sourceId: "Brand", actionId: "Q" },
        { id: "w", sourceId: "Brand", actionId: "W", delayMs: 100 },
      ],
      kits: { Brand: kit },
      target: dummy(2000, 0, 0),
    })
    const burnTickTimes = result.instances
      .filter((i) => i.label === "Ablaze" && i.isTick)
      .map((i) => i.time)
    // No duplicate timestamps -> confirms only one live stream at a time.
    expect(new Set(burnTickTimes).size).toBe(burnTickTimes.length)
  })
})
