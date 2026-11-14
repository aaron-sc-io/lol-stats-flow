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

/** Golden tests for Vayne, hand-verified against
 * https://wiki.leagueoflegends.com/en-us/Vayne (retrieved 2026-11-14,
 * "Template:Data Vayne/Silver_Bolts" + "Template:Data Vayne/Condemn"):
 *   - Silver Bolts: "Bonus True Damage: 4/5.5/7/8.5/10% of target's maximum
 *     health", "Minimum Bonus Damage: 40/55/70/85/100" — the real formula is
 *     `max(DamageFloor[rank], MaxHealthRatio[rank] * target.maxHp)`.
 *     `W.TotalDamage`'s raw calc is `displayAsPercent: true` with a single
 *     `namedDataValue(MaxHealthRatio)` part — its own output is the
 *     *fraction* (e.g. 0.04 = 4%), which must be multiplied by
 *     `target.maxHp`, never used as raw damage directly (same pattern as
 *     Brand's `ExplosionDamage`). The flat floor isn't in any compiled
 *     calc either — read directly off `W.dataValues.DamageFloor`.
 *   - Condemn: "Physical Damage: 50/85/120/155/190 (+50% bonus AD)" +
 *     "Bonus Physical Damage: 75/127.5/180/232.5/285 (+75% bonus AD)" when
 *     the target collides with terrain — the bonus is exactly 1.5× the
 *     normal hit at every rank, matching `E.dataValues.StunDamage` (a
 *     constant 1.5 multiplier). `E.EmpoweredDamageTT`'s raw calc is `(sum
 *     of 0 parts) × namedDataValue(StunDamage)` (always evaluates to 0 —
 *     same tooltip-helper-calc pattern as Darius/Garen/Yasuo) — the real
 *     bonus is computed here as `TotalDamage(ctx) × StunDamage`. */
describe("Vayne golden (pinned 16.22.1) — level 1, rank 1, no items", () => {
  const kit = buildKit(snapshot, {
    championId: "Vayne",
    level: 1,
    items: [],
    rankOverrides: { Q: 1, W: 1, E: 1 },
  })
  const vayne = snapshot.champions.find((c) => c.name === "Vayne")
  if (vayne === undefined) throw new Error("fixture missing")

  it("E (Condemn) rank 1: wiki = 50 (+50% bonus AD); with no items bonus AD is 0, so raw = 50 flat", () => {
    const result = simulate({
      steps: [{ id: "s", sourceId: "Vayne", actionId: "E" }],
      kits: { Vayne: kit },
      target: dummy(2000, 0, 0),
    })
    expect(result.instances[0]?.raw).toBeCloseTo(50)
    expect(result.instances[0]?.damageType).toBe("physical")
  })

  it("E-empowered (Condemn, wall collision) rank 1: bonus = normal hit × 1.5 (StunDamage multiplier), both components present", () => {
    const result = simulate({
      steps: [{ id: "s", sourceId: "Vayne", actionId: "E-empowered" }],
      kits: { Vayne: kit },
      target: dummy(2000, 0, 0),
    })
    expect(result.instances).toHaveLength(2)
    const total = result.instances.reduce((sum, i) => sum + i.raw, 0)
    // wiki: Total Physical Damage rank 1 = 125 (+125% bonus AD); with 0
    // bonus AD, total = 50(normal) + 50*1.5(bonus) = 125.
    expect(total).toBeCloseTo(50 + 50 * 1.5)
  })
})

describe("Vayne golden (pinned 16.22.1) — level 11, rank 5, with Blade of The Ruined King, vs 100 armor / 100 MR target", () => {
  const kit = buildKit(snapshot, {
    championId: "Vayne",
    level: 11,
    items: ["Blade of The Ruined King"],
    rankOverrides: { Q: 5, W: 5, E: 5 },
  })
  const vayne = snapshot.champions.find((c) => c.name === "Vayne")
  if (vayne === undefined) throw new Error("fixture missing")

  it("W (Silver Bolts), fired directly as a combo step: raw = max(DamageFloor[5], MaxHealthRatio[5] * target.maxHp)", () => {
    const result = simulate({
      steps: [{ id: "s", sourceId: "Vayne", actionId: "W" }],
      kits: { Vayne: kit },
      target: dummy(500, 100, 100), // low max HP so the floor dominates
    })
    const floor = vayne.abilities.W.dataValues.DamageFloor?.[5] ?? 0
    const ratio = vayne.abilities.W.dataValues.MaxHealthRatio?.[5] ?? 0
    expect(result.instances[0]?.raw).toBeCloseTo(Math.max(floor, ratio * 500))
    expect(result.instances[0]?.damageType).toBe("true")
  })

  it("W (Silver Bolts) against a high-max-HP target: the %maxHP term dominates over the flat floor", () => {
    const result = simulate({
      steps: [{ id: "s", sourceId: "Vayne", actionId: "W" }],
      kits: { Vayne: kit },
      target: dummy(5000, 100, 100),
    })
    const floor = vayne.abilities.W.dataValues.DamageFloor?.[5] ?? 0
    const ratio = vayne.abilities.W.dataValues.MaxHealthRatio?.[5] ?? 0
    expect(ratio * 5000).toBeGreaterThan(floor)
    expect(result.instances[0]?.raw).toBeCloseTo(ratio * 5000)
  })

  it("Silver Bolts also fires automatically on the 3rd auto attack (every-3rd-hit passive) using the same max() formula", () => {
    const steps = [1, 2, 3].map((n) => ({ id: `s${n}`, sourceId: "Vayne", actionId: "AA" }))
    const result = simulate({ steps, kits: { Vayne: kit }, target: dummy(5000, 0, 0) })
    const silverBolts = result.instances.find((i) => i.label === "Silver Bolts")
    expect(silverBolts).toBeDefined()
    expect(silverBolts?.damageType).toBe("true")
    const ratio = vayne.abilities.W.dataValues.MaxHealthRatio?.[5] ?? 0
    expect(silverBolts?.raw).toBeCloseTo(ratio * 5000)
  })
})
