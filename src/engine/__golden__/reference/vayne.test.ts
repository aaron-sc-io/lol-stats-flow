import { describe, expect, it } from "vitest"
import { buildKit } from "../../kit"
import { simulate } from "../../sim/simulate"
import {
  calcOrThrow,
  findCoefficientFor,
  findRatioDataValueNameFor,
} from "../../test-support/calc-fields"
import { loadSnapshotFixture } from "../../test-support/load-snapshot"

/** Reference-evaluator suite for Vayne (plan §3.3 item 2) — see
 * `reference/yasuo.test.ts` module doc comment for the general approach.
 * `__golden__/pinned/vayne.test.ts` is the companion suite hand-verified
 * against a frozen patch. W's `max(floor, %maxHP)` formula and E's
 * wall-collision multiplier aren't in any compiled calc the engine binding
 * trusts (see `bindings/vayne.ts` doc comment), so both are read straight
 * off `dataValues` here too, mirroring the binding's own documented
 * override rather than a (deliberately unused) compiled calc. */
const snapshot = loadSnapshotFixture()
const dummy = (maxHp: number, armor: number, magicResist: number) => ({
  id: "dummy",
  name: "Dummy",
  maxHp,
  armor,
  magicResist,
  bonusHp: 0,
})

describe("Vayne reference — Q (Tumble) on-hit bonus scales with totalAD + totalAP per dataValues", () => {
  it("Q at rank 4, level 9, with Rabadon's Deathcap: bonus = TotalADRatio[4]*totalAD + APRatio[4]*totalAP", () => {
    const vayne = snapshot.champions.find((c) => c.name === "Vayne")
    if (vayne === undefined) throw new Error("fixture missing")
    const kit = buildKit(snapshot, {
      championId: "Vayne",
      level: 9,
      items: ["Rabadon's Deathcap"],
      rankOverrides: { Q: 4 },
    })
    const result = simulate({
      steps: [{ id: "s", sourceId: "Vayne", actionId: "Q" }],
      kits: { Vayne: kit },
      target: dummy(2000, 0, 0),
    })
    const adRatio = vayne.abilities.Q.dataValues.TotalADRatio?.[4] ?? 0
    const apRatio = vayne.abilities.Q.dataValues.APRatio?.[4] ?? 0
    const expectedBonus =
      adRatio * kit.ctx.stats.total.attackDamage + apRatio * kit.ctx.stats.total.abilityPower
    // Both the AA and the bonus component fire under the same action, so
    // `resolveInstance` tags both with the action's own label ("Tumble (Q,
    // on-hit bonus)") — components are distinguished by firing order, not
    // by instance label (see `sim/simulate.ts`'s `fireAction`).
    const [aa, bonus] = result.instances
    expect(aa?.raw).toBeCloseTo(kit.ctx.stats.total.attackDamage)
    expect(bonus?.raw).toBeCloseTo(expectedBonus)
  })
})

describe("Vayne reference — W (Silver Bolts) is max(DamageFloor, MaxHealthRatio * target.maxHp)", () => {
  it("vs a low-maxHP target, the flat floor dominates", () => {
    const vayne = snapshot.champions.find((c) => c.name === "Vayne")
    if (vayne === undefined) throw new Error("fixture missing")
    const kit = buildKit(snapshot, {
      championId: "Vayne",
      level: 11,
      items: ["Blade of The Ruined King"],
      rankOverrides: { W: 5 },
    })
    const result = simulate({
      steps: [{ id: "s", sourceId: "Vayne", actionId: "W" }],
      kits: { Vayne: kit },
      target: dummy(500, 100, 100),
    })
    const floor = vayne.abilities.W.dataValues.DamageFloor?.[5] ?? 0
    const ratio = vayne.abilities.W.dataValues.MaxHealthRatio?.[5] ?? 0
    expect(result.instances[0]?.raw).toBeCloseTo(Math.max(floor, ratio * 500))
    expect(result.instances[0]?.damageType).toBe("true")
  })

  it("vs a high-maxHP target, the %maxHP term dominates over the flat floor", () => {
    const vayne = snapshot.champions.find((c) => c.name === "Vayne")
    if (vayne === undefined) throw new Error("fixture missing")
    const kit = buildKit(snapshot, {
      championId: "Vayne",
      level: 11,
      items: ["Blade of The Ruined King"],
      rankOverrides: { W: 5 },
    })
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

  it("fires automatically on the 3rd auto attack (every-3rd-hit passive) using the same max() formula", () => {
    const vayne = snapshot.champions.find((c) => c.name === "Vayne")
    if (vayne === undefined) throw new Error("fixture missing")
    const kit = buildKit(snapshot, {
      championId: "Vayne",
      level: 11,
      items: [],
      rankOverrides: { W: 1 },
    })
    const steps = [1, 2, 3].map((n) => ({ id: `s${n}`, sourceId: "Vayne", actionId: "AA" }))
    const result = simulate({ steps, kits: { Vayne: kit }, target: dummy(5000, 0, 0) })
    const silverBolts = result.instances.find((i) => i.label === "Silver Bolts")
    expect(silverBolts).toBeDefined()
    expect(silverBolts?.damageType).toBe("true")
    const ratio = vayne.abilities.W.dataValues.MaxHealthRatio?.[1] ?? 0
    expect(silverBolts?.raw).toBeCloseTo(ratio * 5000)
  })
})

describe("Vayne reference — E (Condemn) empowered bonus is StunDamage-multiplier × the normal hit", () => {
  it("E-empowered at rank 3, level 9: normal = Damage[3] + coefficient*bonusAD; bonus = normal * StunDamage[3]", () => {
    const vayne = snapshot.champions.find((c) => c.name === "Vayne")
    if (vayne === undefined) throw new Error("fixture missing")
    const kit = buildKit(snapshot, {
      championId: "Vayne",
      level: 9,
      items: ["Blade of The Ruined King"],
      rankOverrides: { E: 3 },
    })
    const result = simulate({
      steps: [{ id: "s", sourceId: "Vayne", actionId: "E-empowered" }],
      kits: { Vayne: kit },
      target: dummy(2000, 0, 0),
    })
    const base = vayne.abilities.E.dataValues.Damage?.[3] ?? 0
    const ratio =
      findCoefficientFor(calcOrThrow(vayne.abilities.E, "TotalDamage"), "attackDamage") ?? 0
    const expectedNormal = base + ratio * kit.ctx.stats.bonus.attackDamage
    const stunMultiplier = vayne.abilities.E.dataValues.StunDamage?.[3] ?? 0
    expect(result.instances).toHaveLength(2)
    expect(result.instances[0]?.raw).toBeCloseTo(expectedNormal)
    expect(result.instances[1]?.raw).toBeCloseTo(expectedNormal * stunMultiplier)
  })
  it("sanity: findRatioDataValueNameFor returns undefined for a stat the calc doesn't scale with", () => {
    const vayne = snapshot.champions.find((c) => c.name === "Vayne")
    if (vayne === undefined) throw new Error("fixture missing")
    expect(
      findRatioDataValueNameFor(calcOrThrow(vayne.abilities.E, "TotalDamage"), "abilityPower"),
    ).toBeUndefined()
  })
})
