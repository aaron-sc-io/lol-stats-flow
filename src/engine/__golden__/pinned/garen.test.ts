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

/** Golden tests for Garen, hand-verified against
 * https://wiki.leagueoflegends.com/en-us/Garen (retrieved 2026-11-14,
 * "Template:Data Garen/Judgment"): "Garen rapidly spins his sword around
 * himself 7 (+1 per 25% bonus attack speed) times over 3 seconds ...
 * Physical Damage Per Spin: 4/7/10/13/16 (+40/43/46/49/52% AD)" — matches
 * the snapshot's `E.dataValues.BaseDamagePerTick`/`ADRatioPerTick` exactly
 * at every rank. `E.TotalDamage` is genuinely a *per-tick* value (not a
 * single flat hit) — the engine models all 7 ticks over the 3s duration via
 * `ActionComponent.isDot`, ignoring the real game's bonus-AS-driven extra
 * spins (documented simplification: fixed `NumTicks` per rank). The bonus
 * attack speed scaling of the tick COUNT is intentionally not modeled. */
describe("Garen golden (pinned 16.22.1) — level 1, rank 1, no items", () => {
  const kit = buildKit(snapshot, {
    championId: "Garen",
    level: 1,
    items: [],
    rankOverrides: { Q: 1, E: 1, R: 1 },
  })
  const garen = snapshot.champions.find((c) => c.name === "Garen")
  if (garen === undefined) throw new Error("fixture missing")
  const totalAD = garen.stats.attackDamage // level 1: no growth yet

  it("Q (Decisive Strike) rank 1: wiki = 0 base (+150% total AD) at rank 1", () => {
    const result = simulate({
      steps: [{ id: "s", sourceId: "Garen", actionId: "Q" }],
      kits: { Garen: kit },
      target: dummy(2000, 0, 0),
    })
    const expected = (garen.abilities.Q.dataValues.BaseDamage?.[1] ?? 0) + 1.5 * totalAD
    expect(result.instances[0]?.raw).toBeCloseTo(expected)
    expect(result.instances[0]?.damageType).toBe("physical")
  })

  it("E (Judgment) rank 1: 7 ticks fire, each equal to BaseDamagePerTick[1] + ADRatioPerTick[1]*totalAD", () => {
    const result = simulate({
      steps: [{ id: "s", sourceId: "Garen", actionId: "E" }],
      kits: { Garen: kit },
      target: dummy(5000, 0, 0),
    })
    const ticks = result.instances.filter((i) => i.isTick)
    const numTicks = garen.abilities.E.dataValues.NumTicks?.[1] ?? 7
    expect(ticks).toHaveLength(numTicks)
    const expectedPerTick =
      (garen.abilities.E.dataValues.BaseDamagePerTick?.[1] ?? 0) +
      (garen.abilities.E.dataValues.ADRatioPerTick?.[1] ?? 0) * totalAD
    expect(ticks[0]?.raw).toBeCloseTo(expectedPerTick)
    expect(ticks.every((i) => i.damageType === "physical")).toBe(true)
  })
})

describe("Garen golden (pinned 16.22.1) — level 16, rank 5, with Infinity Edge, vs 100 armor / 100 MR target", () => {
  const kit = buildKit(snapshot, {
    championId: "Garen",
    level: 16,
    items: ["Infinity Edge"],
    rankOverrides: { Q: 5, E: 5, R: 3 },
  })
  const garen = snapshot.champions.find((c) => c.name === "Garen")
  if (garen === undefined) throw new Error("fixture missing")
  // Level 16: growthMultiplier(16) = 15*(0.7025+0.0175*15) = 15*0.965 = 14.475
  const totalAD = garen.stats.attackDamage + garen.stats.attackDamagePerLevel * 14.475 + 75

  it("E-crit (Judgment, crit variant) rank 5: each tick = normal tick * (1 + CritMod)", () => {
    const normal = simulate({
      steps: [{ id: "s", sourceId: "Garen", actionId: "E" }],
      kits: { Garen: kit },
      target: dummy(5000, 100, 100),
    })
    const crit = simulate({
      steps: [{ id: "s", sourceId: "Garen", actionId: "E-crit" }],
      kits: { Garen: kit },
      target: dummy(5000, 100, 100),
    })
    const critMod = garen.abilities.E.dataValues.CritMod?.[5] ?? 0.3
    const normalTick = normal.instances.filter((i) => i.isTick)[0]
    const critTick = crit.instances.filter((i) => i.isTick)[0]
    expect(critTick?.raw).toBeCloseTo((normalTick?.raw ?? 0) * (1 + critMod))
  })

  it("R (Demacian Justice) rank 3 true-damage execute: total = BaseDamage[3] + ExecuteDamage[3]*missingHP", () => {
    const result = simulate({
      steps: [{ id: "s", sourceId: "Garen", actionId: "R" }],
      kits: { Garen: kit },
      target: { ...dummy(2000, 100, 100), currentHp: 400 },
    })
    const base = garen.abilities.R.dataValues.BaseDamage?.[3] ?? 0
    const executePercent = garen.abilities.R.dataValues.ExecuteDamage?.[3] ?? 0
    const expected = base + executePercent * (2000 - 400)
    expect(result.instances.reduce((sum, i) => sum + i.raw, 0)).toBeCloseTo(expected)
    expect(result.instances.every((i) => i.damageType === "true" && i.mitigated === i.raw)).toBe(
      true,
    )
  })
  it("sanity: totalAD matches engine's own statsAt", () => {
    const stats = kit.ctx.stats
    expect(stats.total.attackDamage).toBeCloseTo(totalAD, 1)
  })

  it("E tick count grows by +1 per 25% bonus attack speed (wiki, cited above) on top of the rank-5 base", () => {
    const bonusAsPercent = kit.ctx.stats.total.attackSpeed / garen.stats.attackSpeed - 1
    const expectedExtraSpins = Math.floor(bonusAsPercent / 0.25)
    const baseTicks = garen.abilities.E.dataValues.NumTicks?.[5] ?? 7
    const result = simulate({
      steps: [{ id: "s", sourceId: "Garen", actionId: "E" }],
      kits: { Garen: kit },
      target: dummy(5000, 0, 0),
    })
    const ticks = result.instances.filter((i) => i.isTick)
    expect(ticks).toHaveLength(baseTicks + expectedExtraSpins)
  })
})
