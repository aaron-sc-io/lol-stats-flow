import { describe, expect, it } from "vitest"
import type { Snapshot } from "./schema"
import {
  findChampion,
  findItem,
  listChampions,
  listItems,
  validateSnapshotInDev,
} from "./snapshot-selectors"

function fixtureSnapshot(): Snapshot {
  const ability = {
    slot: "Q" as const,
    name: "Steel Tempest",
    iconUrl: "x",
    maxRank: 5,
    castTime: 0.125,
    cooldowns: [4, 4, 4, 4, 4],
    dataValues: {},
    calculations: {},
    tooltipRaw: null,
    locKeys: { name: null, tooltip: null, summary: null },
  }
  return {
    meta: {
      snapshotSchemaVersion: 1,
      patch: "16.22.1",
      ddragonVersion: "16.22.1",
      cdragonVersion: "16.22",
      generatedAt: "2026-11-14T00:00:00.000Z",
    },
    champions: [
      {
        id: "Yasuo",
        key: 157,
        name: "Yasuo",
        title: "the Unforgiven",
        roles: ["Fighter"],
        iconUrl: "x",
        splashUrl: "x",
        loadingUrl: "x",
        stats: {
          hp: 590,
          hpPerLevel: 110,
          mp: 100,
          mpPerLevel: 0,
          armor: 32,
          armorPerLevel: 4.6,
          magicResist: 32,
          magicResistPerLevel: 2.05,
          attackDamage: 60,
          attackDamagePerLevel: 0,
          attackSpeed: 0.697,
          attackSpeedPerLevel: 3.5,
          attackSpeedRatio: 0.67,
          attackRange: 175,
          moveSpeed: 345,
          hpRegen: 6.5,
          hpRegenPerLevel: 0.9,
          critDamageMultiplier: 2,
        },
        abilities: { P: ability, Q: ability, W: ability, E: ability, R: ability },
        modeled: true,
      },
    ],
    items: [
      {
        id: 3031,
        name: "Infinity Edge",
        iconUrl: "x",
        goldBase: 725,
        goldTotal: 3500,
        goldSell: 2450,
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
      },
    ],
  }
}

describe("snapshot selectors (fixture-backed loader core)", () => {
  const snapshot = fixtureSnapshot()

  it("Given a fixture snapshot, when findChampion is called with a known id, then it returns that champion", () => {
    expect(findChampion(snapshot, "Yasuo")?.name).toBe("Yasuo")
  })

  it("Given a fixture snapshot, when findChampion is called with an unknown id, then it returns undefined", () => {
    expect(findChampion(snapshot, "NotAChampion")).toBeUndefined()
  })

  it("Given a fixture snapshot, when listChampions is called, then it returns every champion", () => {
    expect(listChampions(snapshot)).toHaveLength(1)
  })

  it("Given a fixture snapshot, when findItem is called with a known id, then it returns that item", () => {
    expect(findItem(snapshot, 3031)?.name).toBe("Infinity Edge")
  })

  it("Given a fixture snapshot, when listItems is called, then it returns every item", () => {
    expect(listItems(snapshot)).toHaveLength(1)
  })

  it("Given a valid snapshot, when validated in dev mode, then Zod parsing succeeds and returns the data", () => {
    expect(validateSnapshotInDev(snapshot, true).meta.patch).toBe("16.22.1")
  })

  it("Given a malformed snapshot, when validated in dev mode, then Zod throws", () => {
    const broken = { ...snapshot, champions: "not-an-array" }
    expect(() => validateSnapshotInDev(broken, true)).toThrow()
  })

  it("Given a malformed snapshot, when validated outside dev mode, then it is passed through without throwing", () => {
    const broken = { ...snapshot, champions: "not-an-array" }
    expect(() => validateSnapshotInDev(broken, false)).not.toThrow()
  })
})
