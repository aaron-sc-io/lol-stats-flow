import { z } from "zod"
import { GameCalculationSchema } from "./formula-schema"

export const SNAPSHOT_SCHEMA_VERSION = 1 as const

export const SnapshotMetaSchema = z.object({
  snapshotSchemaVersion: z.literal(SNAPSHOT_SCHEMA_VERSION),
  patch: z.string(),
  ddragonVersion: z.string(),
  cdragonVersion: z.string(),
  generatedAt: z.string(),
})
export type SnapshotMeta = z.infer<typeof SnapshotMetaSchema>

const AbilitySlotSchema = z.enum(["P", "Q", "W", "E", "R"])
export type AbilitySlot = z.infer<typeof AbilitySlotSchema>

export const AbilityDataSchema = z.object({
  slot: AbilitySlotSchema,
  name: z.string(),
  iconUrl: z.string(),
  maxRank: z.number().int(),
  castTime: z.number().nullable(),
  cooldowns: z.array(z.number()),
  dataValues: z.record(z.string(), z.array(z.number())),
  calculations: z.record(z.string(), GameCalculationSchema),
  tooltipRaw: z.string().nullable(),
  locKeys: z.object({
    name: z.string().nullable(),
    tooltip: z.string().nullable(),
    summary: z.string().nullable(),
  }),
})
export type AbilityData = z.infer<typeof AbilityDataSchema>

export const ChampionStatsSchema = z.object({
  hp: z.number(),
  hpPerLevel: z.number(),
  mp: z.number(),
  mpPerLevel: z.number(),
  armor: z.number(),
  armorPerLevel: z.number(),
  magicResist: z.number(),
  magicResistPerLevel: z.number(),
  attackDamage: z.number(),
  attackDamagePerLevel: z.number(),
  attackSpeed: z.number(),
  attackSpeedPerLevel: z.number(),
  /** Riot's `attackSpeedRatioModifiable` — the AS-growth-per-point divisor
   * used in `finalAS = baseAS + bonusASPercent * attackSpeedRatio`. Sourced
   * from CDragon only (DDragon does not expose it). */
  attackSpeedRatio: z.number(),
  attackRange: z.number(),
  moveSpeed: z.number(),
  hpRegen: z.number(),
  hpRegenPerLevel: z.number(),
  critDamageMultiplier: z.number(),
})
export type ChampionStats = z.infer<typeof ChampionStatsSchema>

export const ChampionDataSchema = z.object({
  id: z.string(),
  key: z.number().int(),
  name: z.string(),
  title: z.string(),
  roles: z.array(z.string()),
  iconUrl: z.string(),
  splashUrl: z.string(),
  loadingUrl: z.string(),
  stats: ChampionStatsSchema,
  abilities: z.object({
    P: AbilityDataSchema,
    Q: AbilityDataSchema,
    W: AbilityDataSchema,
    E: AbilityDataSchema,
    R: AbilityDataSchema,
  }),
  modeled: z.boolean(),
})
export type ChampionData = z.infer<typeof ChampionDataSchema>

export const ItemPassiveActiveSchema = z.object({
  name: z.string(),
  dataValues: z.record(z.string(), z.number()),
  calculations: z.record(z.string(), GameCalculationSchema),
  isActive: z.boolean(),
})
export type ItemPassiveActive = z.infer<typeof ItemPassiveActiveSchema>

export const ItemDataSchema = z.object({
  id: z.number().int(),
  name: z.string(),
  iconUrl: z.string(),
  goldBase: z.number(),
  goldTotal: z.number(),
  goldSell: z.number(),
  purchasable: z.boolean(),
  statCategories: z.array(z.string()),
  stats: z.record(z.string(), z.number()),
  from: z.array(z.string()),
  into: z.array(z.string()),
  maps: z.record(z.string(), z.boolean()),
  uniqueGroups: z.array(z.string()),
  maxStack: z.number().int(),
  passivesAndActives: z.array(ItemPassiveActiveSchema),
  modeled: z.boolean(),
})
export type ItemData = z.infer<typeof ItemDataSchema>

export const SnapshotSchema = z.object({
  meta: SnapshotMetaSchema,
  champions: z.array(ChampionDataSchema),
  items: z.array(ItemDataSchema),
})
export type Snapshot = z.infer<typeof SnapshotSchema>
