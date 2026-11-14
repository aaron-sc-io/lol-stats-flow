import { describe, expect, it } from "vitest"
import type { ChampionData, ItemData } from "../../data/snapshot-schema"
import { growthMultiplier, statsAt } from "./stats-at"

function fixtureChampion(overrides: Partial<ChampionData["stats"]> = {}): ChampionData {
  const emptyAbility = (slot: "P" | "Q" | "W" | "E" | "R") => ({
    slot,
    name: "",
    iconUrl: "",
    maxRank: slot === "P" ? 1 : 5,
    castTime: null,
    cooldowns: [],
    dataValues: {},
    calculations: {},
    tooltipRaw: null,
    locKeys: { name: null, tooltip: null, summary: null },
  })
  return {
    id: "testchamp",
    key: 1,
    name: "Test Champion",
    title: "",
    roles: [],
    iconUrl: "",
    splashUrl: "",
    loadingUrl: "",
    stats: {
      hp: 600,
      hpPerLevel: 100,
      mp: 300,
      mpPerLevel: 40,
      armor: 30,
      armorPerLevel: 4,
      magicResist: 30,
      magicResistPerLevel: 1,
      attackDamage: 60,
      attackDamagePerLevel: 3,
      attackSpeed: 0.65,
      attackSpeedPerLevel: 2.5,
      attackSpeedRatio: 0.65,
      attackRange: 150,
      moveSpeed: 340,
      hpRegen: 5,
      hpRegenPerLevel: 0.5,
      critDamageMultiplier: 2,
      ...overrides,
    },
    abilities: {
      P: emptyAbility("P"),
      Q: emptyAbility("Q"),
      W: emptyAbility("W"),
      E: emptyAbility("E"),
      R: emptyAbility("R"),
    },
    modeled: true,
  }
}

function fixtureItem(overrides: Partial<ItemData>): ItemData {
  return {
    id: 0,
    name: "Test Item",
    iconUrl: "",
    goldBase: 0,
    goldTotal: 0,
    goldSell: 0,
    purchasable: true,
    statCategories: [],
    stats: {},
    from: [],
    into: [],
    maps: {},
    uniqueGroups: [],
    maxStack: 1,
    passivesAndActives: [],
    modeled: true,
    ...overrides,
  }
}

describe("growthMultiplier", () => {
  it("Given level 1, when computing the growth multiplier, then it is 0 (no growth applied yet)", () => {
    expect(growthMultiplier(1)).toBe(0)
  })

  it("Given level 18, when computing the growth multiplier, then it equals 17 (the normalized max-level factor)", () => {
    expect(growthMultiplier(18)).toBeCloseTo(17)
  })
})

describe("statsAt — base/growth (no items)", () => {
  it("Given level 1 with no items, when resolved, then total stats equal the champion's raw base stats", () => {
    const stats = statsAt(fixtureChampion(), 1, [])
    expect(stats.total.health).toBeCloseTo(600)
    expect(stats.total.attackDamage).toBeCloseTo(60)
    expect(stats.total.armor).toBeCloseTo(30)
  })

  it("Given level 18 with no items, when resolved, then base stats grow by base + growth*17", () => {
    const stats = statsAt(fixtureChampion(), 18, [])
    expect(stats.total.health).toBeCloseTo(600 + 100 * 17)
    expect(stats.total.attackDamage).toBeCloseTo(60 + 3 * 17)
    expect(stats.base.attackDamage).toBeCloseTo(60 + 3 * 17)
    expect(stats.bonus.attackDamage).toBe(0)
  })

  it("Given a level above 18, when resolved, then the level clamps to 18", () => {
    const uncapped = statsAt(fixtureChampion(), 18, [])
    const overLeveled = statsAt(fixtureChampion(), 30, [])
    expect(overLeveled.total.health).toBeCloseTo(uncapped.total.health)
    expect(overLeveled.level).toBe(18)
  })
})

describe("statsAt — item stats", () => {
  it("Given a flat-AD item, when resolved, then it adds to bonus (not base) attack damage", () => {
    const ironSword = fixtureItem({ stats: { attackDamage: 40 } })
    const stats = statsAt(fixtureChampion(), 1, [ironSword])
    expect(stats.bonus.attackDamage).toBe(40)
    expect(stats.total.attackDamage).toBeCloseTo(100)
  })

  it("Given an AP-amp passive (e.g. Rabadon's Deathcap), when resolved, then total AP is multiplied (not just added)", () => {
    const rabadons = fixtureItem({
      stats: { abilityPower: 130 },
      passivesAndActives: [
        {
          name: "Rabadon's Deathcap",
          dataValues: { APAmp: 0.3 },
          calculations: {},
          isActive: false,
        },
      ],
    })
    const ampTome = fixtureItem({ stats: { abilityPower: 100 } })
    const stats = statsAt(fixtureChampion(), 1, [rabadons, ampTome])
    // (130 + 100) * 1.3 = 299
    expect(stats.total.abilityPower).toBeCloseTo(299)
  })

  it("Given attack speed percent items, when resolved, then AS grows multiplicatively off base AS (not additively)", () => {
    const item = fixtureItem({ stats: { attackSpeedPercent: 0.4 } })
    const stats = statsAt(fixtureChampion(), 1, [item])
    expect(stats.total.attackSpeed).toBeCloseTo(0.65 * 1.4)
  })

  it("Given two items with percent armor penetration, when resolved, then they stack multiplicatively (not additively)", () => {
    const ldr = fixtureItem({ stats: { armorPenetrationPercent: 0.35 } })
    const second = fixtureItem({ stats: { armorPenetrationPercent: 0.3 } })
    const stats = statsAt(fixtureChampion(), 1, [ldr, second])
    // 1 - (1-0.35)(1-0.3) = 1 - 0.455 = 0.545
    expect(stats.total.armorPenetrationPercent).toBeCloseTo(0.545)
  })

  it("Given physical lethality, when resolved, then it converts to flat armor pen scaled by champion level", () => {
    const item = fixtureItem({ stats: { physicalLethality: 18 } })
    const stats = statsAt(fixtureChampion(), 1, [item])
    // level 1: 18 * (0.6 + 0.4*1/18) ≈ 11.2
    expect(stats.total.armorPenetrationFlat).toBeCloseTo(18 * (0.6 + 0.4 / 18), 2)
  })

  it("Given a crit-damage-bonus item (e.g. Infinity Edge's +30%), when resolved, then it adds on top of the champion's base crit multiplier", () => {
    const ie = fixtureItem({ stats: { criticalStrikeDamageBonus: 0.3 } })
    const stats = statsAt(fixtureChampion(), 1, [ie])
    expect(stats.total.criticalStrikeDamageMultiplier).toBeCloseTo(2.3)
  })
})
