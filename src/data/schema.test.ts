import { describe, expect, it } from "vitest"
import { type Snapshot, SnapshotSchema } from "./schema"

function fixtureSnapshot(): Snapshot {
  const emptyAbility = (slot: "P" | "Q" | "W" | "E" | "R") => ({
    slot,
    name: `${slot} name`,
    iconUrl: "https://ddragon.leagueoflegends.com/cdn/16.22.1/img/spell/x.png",
    maxRank: slot === "P" ? 1 : 5,
    castTime: 0.25,
    cooldowns: [4, 4, 4, 4, 4],
    dataValues: { BaseDamage: [1, 2, 3, 4, 5] },
    calculations: {
      TotalDamage: {
        parts: [
          { kind: "namedDataValue" as const, dataValue: "BaseDamage" },
          {
            kind: "statByNamedDataValue" as const,
            dataValue: "ADRatio",
            stat: 2,
            statKey: "attackDamage",
            statFormula: "total" as const,
          },
        ],
      },
    },
    tooltipRaw: "Deals damage.",
    locKeys: { name: "Spell_X_Name", tooltip: "Spell_X_Tooltip", summary: null },
  })

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
        roles: ["Fighter", "Assassin"],
        iconUrl: "https://ddragon.leagueoflegends.com/cdn/16.22.1/img/champion/Yasuo.png",
        splashUrl: "https://ddragon.leagueoflegends.com/cdn/img/champion/splash/Yasuo_0.jpg",
        loadingUrl: "https://ddragon.leagueoflegends.com/cdn/img/champion/loading/Yasuo_0.jpg",
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
          attackRange: 175,
          moveSpeed: 345,
          hpRegen: 6.5,
          hpRegenPerLevel: 0.9,
          critDamageMultiplier: 2,
        },
        abilities: {
          P: emptyAbility("P"),
          Q: emptyAbility("Q"),
          W: emptyAbility("W"),
          E: emptyAbility("E"),
          R: emptyAbility("R"),
        },
        modeled: true,
      },
    ],
    items: [
      {
        id: 3031,
        name: "Infinity Edge",
        iconUrl: "https://ddragon.leagueoflegends.com/cdn/16.22.1/img/item/3031.png",
        goldBase: 725,
        goldTotal: 3500,
        goldSell: 2450,
        purchasable: true,
        statCategories: ["CriticalStrike", "Damage"],
        stats: { criticalStrikeChance: 0.25, attackDamage: 75 },
        from: ["1038", "1037", "1018"],
        into: [],
        maps: { "11": true, "12": true },
        uniqueGroups: ["Items/ItemGroups/Default"],
        maxStack: 1,
        passivesAndActives: [],
        modeled: true,
      },
    ],
  }
}

describe("SnapshotSchema round-trip", () => {
  it("Given a well-formed snapshot fixture, when parsed through the Zod schema, then it round-trips with identical data", () => {
    const fixture = fixtureSnapshot()
    const parsed = SnapshotSchema.parse(fixture)
    expect(parsed).toEqual(fixture)
  })

  it("Given a snapshot with an unknown FormulaNode kind, when parsed, then the discriminated union still validates it (unknown is a first-class variant)", () => {
    const fixture = fixtureSnapshot()
    const withUnknown = {
      ...fixture,
      champions: [
        {
          ...fixture.champions[0],
          abilities: {
            ...fixture.champions[0]?.abilities,
            Q: {
              ...fixture.champions[0]?.abilities.Q,
              calculations: {
                Mystery: { parts: [{ kind: "unknown", type: "{deadbeef}", raw: { mX: 1 } }] },
              },
            },
          },
        },
      ],
    }
    expect(() => SnapshotSchema.parse(withUnknown)).not.toThrow()
  })

  it("Given a snapshot missing a required field, when parsed, then Zod rejects it", () => {
    const fixture = fixtureSnapshot()
    const { patch: _patch, ...metaWithoutPatch } = fixture.meta
    const broken = { ...fixture, meta: metaWithoutPatch }
    expect(() => SnapshotSchema.parse(broken)).toThrow()
  })
})
