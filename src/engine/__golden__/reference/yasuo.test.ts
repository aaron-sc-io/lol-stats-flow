import { describe, expect, it } from "vitest"
import { buildKit } from "../../kit"
import { simulate } from "../../sim/simulate"
import { calcOrThrow, findCoefficientFor } from "../../test-support/calc-fields"
import { loadSnapshotFixture } from "../../test-support/load-snapshot"

/** Reference-evaluator suite (plan §3.3 item 2): recomputes Yasuo's expected
 * damage directly from the CURRENT snapshot's own `dataValues`/calc shape,
 * independently of the engine's binding/compile path (no import from
 * `formula/compile.ts`). Patch-agnostic by construction — a balance change
 * that only adjusts numbers (base damage, ratios) keeps passing; a
 * structural regression (wrong rank index, wrong stat, a calc part that
 * stops compiling) fails it. This is what `data:gates`' golden gate
 * re-runs against every candidate patch; see `__golden__/pinned/yasuo.test.ts`
 * for the companion suite hand-verified against a frozen patch. */
const snapshot = loadSnapshotFixture()
const dummy = (maxHp: number, armor: number, magicResist: number) => ({
  id: "dummy",
  name: "Dummy",
  maxHp,
  armor,
  magicResist,
  bonusHp: 0,
})

describe("Yasuo reference — Q (Steel Tempest) and AA scale with totalAD per the snapshot's own dataValues", () => {
  it("Q at rank 3, level 7, no items: raw = BaseDamage[3] + ADRatio[3] * totalAD", () => {
    const yasuo = snapshot.champions.find((c) => c.name === "Yasuo")
    if (yasuo === undefined) throw new Error("fixture missing")
    const kit = buildKit(snapshot, {
      championId: "Yasuo",
      level: 7,
      items: [],
      rankOverrides: { Q: 3 },
    })
    const result = simulate({
      steps: [{ id: "s", sourceId: "Yasuo", actionId: "Q" }],
      kits: { Yasuo: kit },
      target: dummy(2000, 0, 0),
    })
    const base = yasuo.abilities.Q.dataValues.BaseDamage?.[3] ?? 0
    const ratio = yasuo.abilities.Q.dataValues.ADRatio?.[3] ?? 0
    const expected = base + ratio * kit.ctx.stats.total.attackDamage
    expect(result.instances[0]?.raw).toBeCloseTo(expected)
    expect(result.instances[0]?.damageType).toBe("physical")
  })

  it("AA: raw equals total AD exactly, with an item equipped (Infinity Edge)", () => {
    const kit = buildKit(snapshot, { championId: "Yasuo", level: 11, items: ["Infinity Edge"] })
    const result = simulate({
      steps: [{ id: "s", sourceId: "Yasuo", actionId: "AA" }],
      kits: { Yasuo: kit },
      target: dummy(2000, 0, 0),
    })
    expect(result.instances[0]?.raw).toBeCloseTo(kit.ctx.stats.total.attackDamage)
  })
})

describe("Yasuo reference — E (Sweeping Blade) scales with bonus AD + total AP per dataValues", () => {
  it("E at rank 4, level 11, with Infinity Edge (bonus AD) and no AP: raw = BaseDamage[4] + ADRatio[4]*bonusAD + APRatio[4]*totalAP", () => {
    const yasuo = snapshot.champions.find((c) => c.name === "Yasuo")
    if (yasuo === undefined) throw new Error("fixture missing")
    const kit = buildKit(snapshot, {
      championId: "Yasuo",
      level: 11,
      items: ["Infinity Edge"],
      rankOverrides: { E: 4 },
    })
    const result = simulate({
      steps: [{ id: "s", sourceId: "Yasuo", actionId: "E" }],
      kits: { Yasuo: kit },
      target: dummy(2000, 0, 0),
    })
    const base = yasuo.abilities.E.dataValues.BaseDamage?.[4] ?? 0
    const adRatio = yasuo.abilities.E.dataValues.ADRatio?.[4] ?? 0
    const apRatio = yasuo.abilities.E.dataValues.APRatio?.[4] ?? 0
    const expected =
      base + adRatio * kit.ctx.stats.bonus.attackDamage + apRatio * kit.ctx.stats.total.abilityPower
    expect(result.instances[0]?.raw).toBeCloseTo(expected)
    expect(result.instances[0]?.damageType).toBe("magic")
  })
})

describe("Yasuo reference — R (Last Breath) scales with bonus AD", () => {
  it("R at rank 2, level 11, with Infinity Edge: raw = RBaseDamage[2] + AD-ratio-coefficient*bonusAD", () => {
    const yasuo = snapshot.champions.find((c) => c.name === "Yasuo")
    if (yasuo === undefined) throw new Error("fixture missing")
    const kit = buildKit(snapshot, {
      championId: "Yasuo",
      level: 11,
      items: ["Infinity Edge"],
      rankOverrides: { R: 2 },
    })
    const result = simulate({
      steps: [{ id: "s", sourceId: "Yasuo", actionId: "R" }],
      kits: { Yasuo: kit },
      target: dummy(2000, 0, 0),
    })
    const base = yasuo.abilities.R.dataValues.RBaseDamage?.[2] ?? 0
    const ratio = findCoefficientFor(calcOrThrow(yasuo.abilities.R, "Damage"), "attackDamage") ?? 0
    expect(result.instances[0]?.raw).toBeCloseTo(base + ratio * kit.ctx.stats.bonus.attackDamage)
    expect(result.instances[0]?.damageType).toBe("physical")
  })
})
