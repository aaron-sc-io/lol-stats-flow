import { describe, expect, it } from "vitest"
import { buildKit } from "../../kit"
import { simulate } from "../../sim/simulate"
import { loadSnapshotFixture } from "../../test-support/load-snapshot"

/** Reference-evaluator suite for Garen (plan §3.3 item 2) — see
 * `reference/yasuo.test.ts` module doc comment for the general approach.
 * `__golden__/pinned/garen.test.ts` is the companion suite hand-verified
 * against a frozen patch. R has no compiled calc at all in CDragon's bin
 * data (`R.calcs = []`), so its flat + execute-percent components are read
 * directly off `R.dataValues` here too (mirrors the binding's own
 * documented override, see `bindings/garen.ts`). */
const snapshot = loadSnapshotFixture()
const dummy = (maxHp: number, armor: number, magicResist: number) => ({
  id: "dummy",
  name: "Dummy",
  maxHp,
  armor,
  magicResist,
  bonusHp: 0,
})

describe("Garen reference — Q (Decisive Strike) scales with totalAD via a named ratio dataValue", () => {
  it("Q at rank 4, level 9, with Infinity Edge: raw = BaseDamage[4] + tADRatio[4]*totalAD", () => {
    const garen = snapshot.champions.find((c) => c.name === "Garen")
    if (garen === undefined) throw new Error("fixture missing")
    const kit = buildKit(snapshot, {
      championId: "Garen",
      level: 9,
      items: ["Infinity Edge"],
      rankOverrides: { Q: 4 },
    })
    const result = simulate({
      steps: [{ id: "s", sourceId: "Garen", actionId: "Q" }],
      kits: { Garen: kit },
      target: dummy(2000, 0, 0),
    })
    const base = garen.abilities.Q.dataValues.BaseDamage?.[4] ?? 0
    const ratio = garen.abilities.Q.dataValues.tADRatio?.[4] ?? 0
    expect(result.instances[0]?.raw).toBeCloseTo(base + ratio * kit.ctx.stats.total.attackDamage)
    expect(result.instances[0]?.damageType).toBe("physical")
  })
})

describe("Garen reference — E (Judgment) per-tick damage and tick count come straight from dataValues", () => {
  it("E at rank 3, level 11, no items: NumTicks[3] ticks fire, each = BaseDamagePerTick[3] + ADRatioPerTick[3]*totalAD", () => {
    const garen = snapshot.champions.find((c) => c.name === "Garen")
    if (garen === undefined) throw new Error("fixture missing")
    const kit = buildKit(snapshot, {
      championId: "Garen",
      level: 11,
      items: [],
      rankOverrides: { E: 3 },
    })
    const result = simulate({
      steps: [{ id: "s", sourceId: "Garen", actionId: "E" }],
      kits: { Garen: kit },
      target: dummy(5000, 0, 0),
    })
    const ticks = result.instances.filter((i) => i.isTick)
    // "+1 per 25% bonus attack speed" (wiki, see `bindings/garen.ts`) applies
    // even with no items, since Garen's own per-level AS growth already
    // grants bonus attack speed at level 11.
    const baseTicks = garen.abilities.E.dataValues.NumTicks?.[3] ?? 7
    const bonusAsPercent = kit.ctx.stats.total.attackSpeed / garen.stats.attackSpeed - 1
    const extraSpins = Math.max(0, Math.floor(bonusAsPercent / 0.25))
    const numTicks = baseTicks + extraSpins
    expect(ticks).toHaveLength(numTicks)
    const expectedPerTick =
      (garen.abilities.E.dataValues.BaseDamagePerTick?.[3] ?? 0) +
      (garen.abilities.E.dataValues.ADRatioPerTick?.[3] ?? 0) * kit.ctx.stats.total.attackDamage
    expect(ticks[0]?.raw).toBeCloseTo(expectedPerTick)
    expect(ticks.every((i) => i.damageType === "physical")).toBe(true)
  })

  it("E-crit tick = normal tick * (1 + CritMod[rank])", () => {
    const garen = snapshot.champions.find((c) => c.name === "Garen")
    if (garen === undefined) throw new Error("fixture missing")
    const kit = buildKit(snapshot, {
      championId: "Garen",
      level: 11,
      items: [],
      rankOverrides: { E: 5 },
    })
    const normal = simulate({
      steps: [{ id: "s", sourceId: "Garen", actionId: "E" }],
      kits: { Garen: kit },
      target: dummy(5000, 0, 0),
    })
    const crit = simulate({
      steps: [{ id: "s", sourceId: "Garen", actionId: "E-crit" }],
      kits: { Garen: kit },
      target: dummy(5000, 0, 0),
    })
    const critMod = garen.abilities.E.dataValues.CritMod?.[5] ?? 0.3
    const normalTick = normal.instances.filter((i) => i.isTick)[0]
    const critTick = crit.instances.filter((i) => i.isTick)[0]
    expect(critTick?.raw).toBeCloseTo((normalTick?.raw ?? 0) * (1 + critMod))
  })
})

describe("Garen reference — R (Demacian Justice) is a true-damage execute scaling with missing HP", () => {
  it("R at rank 1, level 6: total = BaseDamage[1] + ExecuteDamage[1]*missingHP, all true damage", () => {
    const garen = snapshot.champions.find((c) => c.name === "Garen")
    if (garen === undefined) throw new Error("fixture missing")
    const kit = buildKit(snapshot, {
      championId: "Garen",
      level: 6,
      items: [],
      rankOverrides: { R: 1 },
    })
    const result = simulate({
      steps: [{ id: "s", sourceId: "Garen", actionId: "R" }],
      kits: { Garen: kit },
      target: { ...dummy(2000, 100, 100), currentHp: 700 },
    })
    const base = garen.abilities.R.dataValues.BaseDamage?.[1] ?? 0
    const executePercent = garen.abilities.R.dataValues.ExecuteDamage?.[1] ?? 0
    const expected = base + executePercent * (2000 - 700)
    expect(result.instances.reduce((sum, i) => sum + i.raw, 0)).toBeCloseTo(expected)
    expect(result.instances.every((i) => i.damageType === "true" && i.mitigated === i.raw)).toBe(
      true,
    )
  })
})
