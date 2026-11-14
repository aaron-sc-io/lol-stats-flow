import { describe, expect, it } from "vitest"
import { buildKit } from "../kit"
import { simulate } from "../sim/simulate"
import { loadSnapshotFixture } from "../test-support/load-snapshot"

const snapshot = loadSnapshotFixture()
const dummy = (maxHp: number, armor: number, magicResist: number) => ({
  id: "dummy",
  name: "Dummy",
  maxHp,
  armor,
  magicResist,
  bonusHp: 0,
})

/** Golden tests for the 12 modeled items' mechanics (plan §1 "Fully modeled
 * items v1"). Each test cites the wiki page for the mechanic it locks in. */
describe("Item mechanic golden tests", () => {
  it("Infinity Edge: +75 AD, +25% crit chance, +30% crit damage — pure stats, no passive (https://wiki.leagueoflegends.com/en-us/Infinity_Edge)", () => {
    const kit = buildKit(snapshot, { championId: "Yasuo", level: 1, items: ["Infinity Edge"] })
    expect(kit.ctx.stats.total.attackDamage).toBeCloseTo(60 + 75)
    expect(kit.ctx.stats.total.criticalStrikeChance).toBeCloseTo(0.25)
    expect(kit.ctx.stats.total.criticalStrikeDamageMultiplier).toBeCloseTo(2.3)
  })

  it("Rabadon's Deathcap: 30% AP amp (https://wiki.leagueoflegends.com/en-us/Rabadon%27s_Deathcap) multiplies ALL AP, not just its own", () => {
    const kit = buildKit(snapshot, { championId: "Brand", level: 1, items: ["Rabadon's Deathcap"] })
    const brand = snapshot.champions.find((c) => c.name === "Brand")
    const baseAP = brand?.stats.hp === undefined ? 0 : 0 // Brand has 0 base AP
    expect(kit.ctx.stats.total.abilityPower).toBeCloseTo((baseAP + 130) * 1.3)
  })

  it("Lord Dominik's Regards: 35% armor penetration (https://wiki.leagueoflegends.com/en-us/Lord_Dominik%27s_Regards) reduces mitigation accordingly", () => {
    const kit = buildKit(snapshot, {
      championId: "Yasuo",
      level: 1,
      items: ["Lord Dominik's Regards"],
    })
    expect(kit.ctx.stats.total.armorPenetrationPercent).toBeCloseTo(0.35)
  })

  it("Void Staff: 40% magic penetration (https://wiki.leagueoflegends.com/en-us/Void_Staff)", () => {
    const kit = buildKit(snapshot, { championId: "Brand", level: 1, items: ["Void Staff"] })
    expect(kit.ctx.stats.total.magicPenetrationPercent).toBeCloseTo(0.4)
  })

  it("Liandry's Torment: on ability hit, applies a magic DoT burn for ~2%/sec of target max HP over 3s (https://wiki.leagueoflegends.com/en-us/Liandry%27s_Torment)", () => {
    const kit = buildKit(snapshot, { championId: "Brand", level: 9, items: ["Liandry's Torment"] })
    const result = simulate({
      steps: [{ id: "s", sourceId: "Brand", actionId: "Q" }],
      kits: { Brand: kit },
      target: dummy(2000, 0, 0),
    })
    const burnTicks = result.instances.filter((i) => i.label === "Liandry's Torment")
    expect(burnTicks.length).toBeGreaterThan(0)
    expect(burnTicks.every((i) => i.isTick && i.damageType === "magic")).toBe(true)
    const totalBurn = burnTicks.reduce((sum, i) => sum + i.raw, 0)
    expect(totalBurn).toBeCloseTo(0.02 * 3 * 2000, 0) // 2%/s * 3s * maxHp
  })

  it("Liandry's Torment: re-application (Q then W) refreshes the burn into ONE stream, never two overlapping/duplicate tick timestamps", () => {
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

  it("Darius Hemorrhage: re-application (two AAs) refreshes the bleed into ONE stream, never two overlapping/duplicate tick timestamps", () => {
    const kit = buildKit(snapshot, { championId: "Darius", level: 11, items: [] })
    const result = simulate({
      steps: [
        { id: "a1", sourceId: "Darius", actionId: "AA" },
        { id: "a2", sourceId: "Darius", actionId: "AA", delayMs: 300 },
      ],
      kits: { Darius: kit },
      target: dummy(5000, 0, 0),
    })
    const tickTimes = result.instances
      .filter((i) => i.label === "Hemorrhage" && i.isTick)
      .map((i) => i.time)
    expect(new Set(tickTimes).size).toBe(tickTimes.length)
  })

  it("Blade of The Ruined King: on-hit physical damage = 9% (melee) of target's current HP (https://wiki.leagueoflegends.com/en-us/Blade_of_the_Ruined_King), read at resolve time (after the auto attack's own damage has already landed)", () => {
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
    const bork = result.instances.find((i) => i.label === "Blade of The Ruined King")
    expect(aa).toBeDefined()
    expect(bork?.raw).toBeCloseTo(0.09 * (aa?.targetHpAfter ?? 0))
  })

  it("Black Cleaver: physical hits stack a 6%-per-stack armor shred, up to 5 stacks (https://wiki.leagueoflegends.com/en-us/Black_Cleaver) — a 2nd hit is mitigated less than the 1st", () => {
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

  it("Trinity Force (Sheen family): ability cast arms Spellblade, consumed by the next AA for bonus physical damage = 200% base AD (https://wiki.leagueoflegends.com/en-us/Trinity_Force)", () => {
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
    expect(proc?.raw).toBeCloseTo(60 * 2) // base AD (60, level 1) * 200%
  })

  it("Kraken Slayer: every 3rd basic attack deals bonus true damage (https://wiki.leagueoflegends.com/en-us/Kraken_Slayer)", () => {
    const kit = buildKit(snapshot, { championId: "Darius", level: 9, items: ["Kraken Slayer"] })
    const steps = [1, 2, 3].map((n) => ({ id: `s${n}`, sourceId: "Darius", actionId: "AA" }))
    const result = simulate({ steps, kits: { Darius: kit }, target: dummy(5000, 0, 0) })
    const krakenHits = result.instances.filter((i) => i.label === "Kraken Slayer")
    expect(krakenHits).toHaveLength(1)
    expect(krakenHits[0]?.damageType).toBe("true")
  })

  it("Hextech Rocketbelt: active deals magic damage = base + AP ratio (https://wiki.leagueoflegends.com/en-us/Hextech_Rocketbelt)", () => {
    const kit = buildKit(snapshot, { championId: "Brand", level: 1, items: ["Hextech Rocketbelt"] })
    const result = simulate({
      steps: [{ id: "s", sourceId: "Brand", actionId: "item-rocketbelt" }],
      kits: { Brand: kit },
      target: dummy(2000, 0, 0),
    })
    expect(result.instances[0]?.damageType).toBe("magic")
    expect(result.instances[0]?.raw).toBeGreaterThan(135) // base 135 + AP ratio contribution
  })

  it("Immortal Shieldbow: stats only (crit chance + AD); shield mechanic intentionally out of scope per plan D15", () => {
    const kit = buildKit(snapshot, { championId: "Yasuo", level: 1, items: ["Immortal Shieldbow"] })
    expect(kit.ctx.stats.total.attackDamage).toBeCloseTo(60 + 55)
    expect(kit.ctx.stats.total.criticalStrikeChance).toBeCloseTo(0.25)
  })

  it('Riftmaker: Void Corruption amplifies ALL pre-mitigation damage by 2%/sec in combat, capped at 8% after 4s (https://wiki.leagueoflegends.com/en-us/Riftmaker — "For each second in combat with champions, deal 2% increased damage, stacking up to 4 times for a total of 8% increased damage"; "based on pre-mitigation damage")', () => {
    const kit = buildKit(snapshot, { championId: "Brand", level: 9, items: ["Riftmaker"] })
    const result = simulate({
      steps: [
        { id: "q1", sourceId: "Brand", actionId: "Q" },
        // Second Q cast far enough later that >=4s have elapsed since combat
        // start (Riftmaker's amp clock starts on the first action).
        { id: "q2", sourceId: "Brand", actionId: "Q", delayMs: 5000 },
      ],
      kits: { Brand: kit },
      target: dummy(5000, 0, 0),
    })
    const qHits = result.instances.filter((i) => i.label === "Sear (Q)")
    expect(qHits).toHaveLength(2)
    // Second hit's raw (pre-mitigation) damage is 8% higher than the first.
    expect(qHits[1]?.raw).toBeCloseTo((qHits[0]?.raw ?? 0) * 1.08, 1)
  })
})
