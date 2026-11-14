import { describe, expect, it } from "vitest"
import { buildKit } from "../../kit"
import { simulate } from "../../sim/simulate"
import { loadSnapshotFixture } from "../../test-support/load-snapshot"

/** Reference-evaluator suite for the 13 modeled items (plan §3.3 item 2):
 * recomputes expected values directly from the CURRENT snapshot's own
 * `item.stats`/`passivesAndActives[].dataValues`, independently of the
 * engine's `stats/stats-at.ts` aggregation and `bindings/items.ts` — a
 * routine balance-patch number change (AD/AP/ratio bumped or nerfed) keeps
 * this suite passing; a structural regression (item stat renamed/dropped,
 * dataValue the binding needs removed) fails it. `__golden__/pinned/items.test.ts`
 * is the companion suite hand-verified against a frozen patch. */
const snapshot = loadSnapshotFixture()
const dummy = (maxHp: number, armor: number, magicResist: number) => ({
  id: "dummy",
  name: "Dummy",
  maxHp,
  armor,
  magicResist,
  bonusHp: 0,
})
function item(name: string) {
  const found = snapshot.items.find((i) => i.name === name)
  if (found === undefined) throw new Error(`fixture item missing: ${name}`)
  return found
}

describe("Item mechanic reference tests (current snapshot, patch-agnostic)", () => {
  it("Infinity Edge: pure stats (AD, crit chance, crit damage bonus), no passive", () => {
    const ie = item("Infinity Edge")
    const kit = buildKit(snapshot, { championId: "Yasuo", level: 1, items: ["Infinity Edge"] })
    const yasuo = snapshot.champions.find((c) => c.name === "Yasuo")
    if (yasuo === undefined) throw new Error("fixture missing")
    expect(kit.ctx.stats.total.attackDamage).toBeCloseTo(
      yasuo.stats.attackDamage + (ie.stats.attackDamage ?? 0),
    )
    expect(kit.ctx.stats.total.criticalStrikeChance).toBeCloseTo(ie.stats.criticalStrikeChance ?? 0)
    expect(kit.ctx.stats.total.criticalStrikeDamageMultiplier).toBeCloseTo(
      yasuo.stats.critDamageMultiplier + (ie.stats.criticalStrikeDamageBonus ?? 0),
    )
  })

  it("Rabadon's Deathcap: APAmp (passive dataValue) multiplies ALL ability power, not just its own", () => {
    const rabadons = item("Rabadon's Deathcap")
    const kit = buildKit(snapshot, { championId: "Brand", level: 1, items: ["Rabadon's Deathcap"] })
    const amp = rabadons.passivesAndActives[0]?.dataValues.APAmp ?? 0
    expect(kit.ctx.stats.total.abilityPower).toBeCloseTo(
      (rabadons.stats.abilityPower ?? 0) * (1 + amp),
    )
  })

  it("Lord Dominik's Regards: armor penetration percent passes straight through to total stats", () => {
    const ldr = item("Lord Dominik's Regards")
    const kit = buildKit(snapshot, {
      championId: "Yasuo",
      level: 1,
      items: ["Lord Dominik's Regards"],
    })
    expect(kit.ctx.stats.total.armorPenetrationPercent).toBeCloseTo(
      ldr.stats.armorPenetrationPercent ?? 0,
    )
  })

  it("Void Staff: magic penetration percent passes straight through to total stats", () => {
    const voidStaff = item("Void Staff")
    const kit = buildKit(snapshot, { championId: "Brand", level: 1, items: ["Void Staff"] })
    expect(kit.ctx.stats.total.magicPenetrationPercent).toBeCloseTo(
      voidStaff.stats.magicPenetrationPercent ?? 0,
    )
  })

  it("Liandry's Torment: burn DoT totals BurnPercentHealthDamage * BurnDuration of target max HP", () => {
    const liandrys = item("Liandry's Torment")
    const dv = liandrys.passivesAndActives[0]?.dataValues ?? {}
    const kit = buildKit(snapshot, { championId: "Brand", level: 9, items: ["Liandry's Torment"] })
    const result = simulate({
      steps: [{ id: "s", sourceId: "Brand", actionId: "Q" }],
      kits: { Brand: kit },
      target: dummy(2000, 0, 0),
    })
    const burnTicks = result.instances.filter((i) => i.label === "Liandry's Torment")
    expect(burnTicks.length).toBeGreaterThan(0)
    expect(burnTicks.every((i) => i.isTick && i.damageType === "magic")).toBe(true)
    const expected = (dv.BurnPercentHealthDamage ?? 0) * (dv.BurnDuration ?? 0) * 2000
    expect(burnTicks.reduce((sum, i) => sum + i.raw, 0)).toBeCloseTo(expected, 0)
  })

  it("Liandry's Torment: re-application refreshes the burn into ONE stream (no duplicate tick timestamps)", () => {
    const kit = buildKit(snapshot, { championId: "Brand", level: 9, items: ["Liandry's Torment"] })
    const result = simulate({
      steps: [
        { id: "q", sourceId: "Brand", actionId: "Q" },
        { id: "w", sourceId: "Brand", actionId: "W", delayMs: 100 },
      ],
      kits: { Brand: kit },
      target: dummy(2000, 0, 0),
    })
    const tickTimes = result.instances
      .filter((i) => i.label === "Liandry's Torment" && i.isTick)
      .map((i) => i.time)
    expect(new Set(tickTimes).size).toBe(tickTimes.length)
  })

  it("Blade of The Ruined King: on-hit physical damage = MeleeValue (melee champion) of target's current HP after the AA lands", () => {
    const bork = item("Blade of The Ruined King")
    const meleeValue = bork.passivesAndActives[0]?.dataValues.MeleeValue ?? 0
    const kit = buildKit(snapshot, {
      championId: "Darius",
      level: 11,
      items: ["Blade of The Ruined King"],
    })
    const result = simulate({
      steps: [{ id: "s", sourceId: "Darius", actionId: "AA" }],
      kits: { Darius: kit },
      target: dummy(1000, 0, 0),
    })
    const aa = result.instances.find((i) => i.label === "Auto Attack")
    const hit = result.instances.find((i) => i.label === "Blade of The Ruined King")
    expect(aa).toBeDefined()
    expect(hit?.raw).toBeCloseTo(meleeValue * (aa?.targetHpAfter ?? 0))
  })

  it("Black Cleaver: physical hits stack an armor shred (ShredPerStack) — a 2nd hit is mitigated less than the 1st", () => {
    const kit = buildKit(snapshot, { championId: "Darius", level: 11, items: ["Black Cleaver"] })
    const result = simulate({
      steps: [
        { id: "a", sourceId: "Darius", actionId: "AA" },
        { id: "b", sourceId: "Darius", actionId: "AA" },
      ],
      kits: { Darius: kit },
      target: dummy(5000, 100, 0),
    })
    const aaHits = result.instances.filter((i) => i.label === "Auto Attack")
    expect(aaHits).toHaveLength(2)
    expect(aaHits[1]?.mitigated).toBeGreaterThan(aaHits[0]?.mitigated ?? 0)
  })

  it("Trinity Force (Sheen family): ability cast arms Spellblade, consumed by the next AA for SpellbladeMultiplier * base AD", () => {
    const trinity = item("Trinity Force")
    const multiplier = trinity.passivesAndActives[0]?.dataValues.SpellbladeMultiplier ?? 0
    const kit = buildKit(snapshot, { championId: "Yasuo", level: 1, items: ["Trinity Force"] })
    const result = simulate({
      steps: [
        { id: "a", sourceId: "Yasuo", actionId: "Q" },
        { id: "b", sourceId: "Yasuo", actionId: "AA" },
      ],
      kits: { Yasuo: kit },
      target: dummy(2000, 0, 0),
    })
    const proc = result.instances.find((i) => i.label.includes("Spellblade"))
    expect(proc).toBeDefined()
    expect(proc?.raw).toBeCloseTo(multiplier * kit.ctx.stats.base.attackDamage)
  })

  it("Kraken Slayer: every 3rd basic attack deals bonus true damage equal to the level-1 breakpoint value at level 1", () => {
    const kraken = item("Kraken Slayer")
    const damageAmountCalc = kraken.passivesAndActives[0]?.calculations.DamageAmount
    if (damageAmountCalc === undefined) {
      throw new Error("Kraken Slayer passive has no DamageAmount calc")
    }
    const level1Value = damageAmountCalc.parts.find((p) => p.kind === "byCharLevelBreakpoints")
    if (level1Value === undefined || level1Value.kind !== "byCharLevelBreakpoints") {
      throw new Error("Kraken Slayer's DamageAmount no longer has a byCharLevelBreakpoints part")
    }
    const kit = buildKit(snapshot, { championId: "Darius", level: 1, items: ["Kraken Slayer"] })
    const steps = [1, 2, 3].map((n) => ({ id: `s${n}`, sourceId: "Darius", actionId: "AA" }))
    const result = simulate({ steps, kits: { Darius: kit }, target: dummy(5000, 0, 0) })
    const krakenHits = result.instances.filter((i) => i.label === "Kraken Slayer")
    expect(krakenHits).toHaveLength(1)
    expect(krakenHits[0]?.damageType).toBe("true")
    expect(krakenHits[0]?.raw).toBeCloseTo(level1Value.level1Value)
  })

  it("Hextech Rocketbelt: active deals magic damage = BaseDamage + APRatio*totalAP", () => {
    const rocketbelt = item("Hextech Rocketbelt")
    const dv = rocketbelt.passivesAndActives[0]?.dataValues ?? {}
    const kit = buildKit(snapshot, { championId: "Brand", level: 1, items: ["Hextech Rocketbelt"] })
    const result = simulate({
      steps: [{ id: "s", sourceId: "Brand", actionId: "item-rocketbelt" }],
      kits: { Brand: kit },
      target: dummy(2000, 0, 0),
    })
    expect(result.instances[0]?.damageType).toBe("magic")
    const expected = (dv.BaseDamage ?? 0) + (dv.APRatio ?? 0) * kit.ctx.stats.total.abilityPower
    expect(result.instances[0]?.raw).toBeCloseTo(expected)
  })

  it("Immortal Shieldbow: stats only (crit chance + AD); shield mechanic intentionally out of scope per plan D15", () => {
    const shieldbow = item("Immortal Shieldbow")
    const kit = buildKit(snapshot, { championId: "Yasuo", level: 1, items: ["Immortal Shieldbow"] })
    const yasuo = snapshot.champions.find((c) => c.name === "Yasuo")
    if (yasuo === undefined) throw new Error("fixture missing")
    expect(kit.ctx.stats.total.attackDamage).toBeCloseTo(
      yasuo.stats.attackDamage + (shieldbow.stats.attackDamage ?? 0),
    )
    expect(kit.ctx.stats.total.criticalStrikeChance).toBeCloseTo(
      shieldbow.stats.criticalStrikeChance ?? 0,
    )
  })

  it("Riftmaker: Void Corruption amplifies ALL pre-mitigation damage, capped at EternityDamageIncreaseMax after SecondsInCombat", () => {
    const riftmaker = item("Riftmaker")
    const dv = riftmaker.passivesAndActives[0]?.dataValues ?? {}
    const kit = buildKit(snapshot, { championId: "Brand", level: 9, items: ["Riftmaker"] })
    const result = simulate({
      steps: [
        { id: "q1", sourceId: "Brand", actionId: "Q" },
        { id: "q2", sourceId: "Brand", actionId: "Q", delayMs: 5000 },
      ],
      kits: { Brand: kit },
      target: dummy(5000, 0, 0),
    })
    const qHits = result.instances.filter((i) => i.label === "Sear (Q)")
    expect(qHits).toHaveLength(2)
    const max = dv.EternityDamageIncreaseMax ?? 0
    expect(qHits[1]?.raw).toBeCloseTo((qHits[0]?.raw ?? 0) * (1 + max), 1)
  })
})
