import type {
  AbilityData,
  AbilitySlot,
  ChampionData,
  ChampionStats,
} from "../../../src/data/snapshot-schema"
import {
  ddragonChampionIconUrl,
  ddragonLoadingUrl,
  ddragonPassiveIconUrl,
  ddragonSpellIconUrl,
  ddragonSplashUrl,
} from "../ddragon-client"
import { buildCalculationMap } from "./formula"
import type { HashTable } from "./hash-resolver"

export type DdragonSpell = {
  readonly id: string
  readonly name: string
  readonly maxrank: number
  readonly tooltip: string
  readonly image: { readonly full: string }
}

export type DdragonChampionEntry = {
  readonly id: string
  readonly key: string
  readonly name: string
  readonly title: string
  readonly tags: readonly string[]
  readonly image: { readonly full: string }
  readonly stats: Record<string, number>
  readonly spells: readonly DdragonSpell[]
  readonly passive: { readonly name: string; readonly image: { readonly full: string } }
}

type RawBin = Record<string, unknown>

function findCharacterRecord(bin: RawBin): RawBin | null {
  for (const [key, value] of Object.entries(bin)) {
    if (key.endsWith("/CharacterRecords/Root") && value !== null && typeof value === "object") {
      return value as RawBin
    }
  }
  return null
}

function lookupPath(bin: RawBin, path: string): RawBin | null {
  const direct = bin[path]
  if (direct !== null && typeof direct === "object") {
    return direct as RawBin
  }
  const lowerTarget = path.toLowerCase()
  for (const [key, value] of Object.entries(bin)) {
    if (key.toLowerCase() === lowerTarget && value !== null && typeof value === "object") {
      return value as RawBin
    }
  }
  return null
}

function buildStats(
  ddragonStats: Record<string, number>,
  critDamageMultiplier: number,
): ChampionStats {
  return {
    hp: ddragonStats.hp ?? 0,
    hpPerLevel: ddragonStats.hpperlevel ?? 0,
    mp: ddragonStats.mp ?? 0,
    mpPerLevel: ddragonStats.mpperlevel ?? 0,
    armor: ddragonStats.armor ?? 0,
    armorPerLevel: ddragonStats.armorperlevel ?? 0,
    magicResist: ddragonStats.spellblock ?? 0,
    magicResistPerLevel: ddragonStats.spellblockperlevel ?? 0,
    attackDamage: ddragonStats.attackdamage ?? 0,
    attackDamagePerLevel: ddragonStats.attackdamageperlevel ?? 0,
    attackSpeed: ddragonStats.attackspeed ?? 0,
    attackSpeedPerLevel: ddragonStats.attackspeedperlevel ?? 0,
    attackRange: ddragonStats.attackrange ?? 0,
    moveSpeed: ddragonStats.movespeed ?? 0,
    hpRegen: ddragonStats.hpregen ?? 0,
    hpRegenPerLevel: ddragonStats.hpregenperlevel ?? 0,
    critDamageMultiplier,
  }
}

function buildAbilityFromSpellRecord(
  slot: AbilitySlot,
  ddragonSpell: { name: string; maxrank: number; tooltip: string; image: { full: string } },
  spellRecord: RawBin | null,
  hashes: HashTable,
  iconUrlFor: (imageFull: string) => string,
): AbilityData {
  const spell = spellRecord !== null ? (spellRecord.mSpell as RawBin | undefined) : undefined
  const dataValuesRaw =
    spell !== undefined && Array.isArray(spell.DataValues) ? spell.DataValues : []
  const dataValues: Record<string, number[]> = {}
  for (const entry of dataValuesRaw as RawBin[]) {
    if (typeof entry.name === "string" && Array.isArray(entry.values)) {
      dataValues[entry.name] = entry.values.filter((v): v is number => typeof v === "number")
    }
  }
  const calculations = buildCalculationMap(spell?.mSpellCalculations, hashes)
  const clientData = spell !== undefined ? (spell.mClientData as RawBin | undefined) : undefined
  const tooltipData =
    clientData !== undefined ? (clientData.mTooltipData as RawBin | undefined) : undefined
  const locKeysRaw =
    tooltipData !== undefined ? (tooltipData.mLocKeys as RawBin | undefined) : undefined
  const cooldowns =
    spell !== undefined && Array.isArray(spell.cooldownTime)
      ? spell.cooldownTime.filter((v): v is number => typeof v === "number")
      : []

  return {
    slot,
    name: ddragonSpell.name,
    iconUrl: iconUrlFor(ddragonSpell.image.full),
    maxRank: ddragonSpell.maxrank,
    castTime:
      spell !== undefined && typeof spell.spellCastTime === "number" ? spell.spellCastTime : null,
    cooldowns,
    dataValues,
    calculations,
    tooltipRaw: ddragonSpell.tooltip,
    locKeys: {
      name: typeof locKeysRaw?.keyName === "string" ? locKeysRaw.keyName : null,
      tooltip: typeof locKeysRaw?.keyTooltip === "string" ? locKeysRaw.keyTooltip : null,
      summary: typeof locKeysRaw?.keySummary === "string" ? locKeysRaw.keySummary : null,
    },
  }
}

export function normalizeChampion(
  entry: DdragonChampionEntry,
  bin: RawBin | null,
  ddragonVersion: string,
  hashes: HashTable,
  modeled: boolean,
): ChampionData {
  const record = bin !== null ? findCharacterRecord(bin) : null
  const critDamageMultiplier =
    record !== null && typeof record.critDamageMultiplier === "number"
      ? record.critDamageMultiplier
      : 2

  const spellPaths =
    record !== null && Array.isArray(record.spells) ? (record.spells as string[]) : []
  const slots: AbilitySlot[] = ["Q", "W", "E", "R"]
  const abilitiesBySlot: Partial<Record<AbilitySlot, AbilityData>> = {}

  slots.forEach((slot, index) => {
    const ddragonSpell = entry.spells[index]
    if (ddragonSpell === undefined) {
      return
    }
    const path = spellPaths[index]
    const spellRecord = bin !== null && path !== undefined ? lookupPath(bin, path) : null
    abilitiesBySlot[slot] = buildAbilityFromSpellRecord(
      slot,
      ddragonSpell,
      spellRecord,
      hashes,
      (imageFull) => ddragonSpellIconUrl(ddragonVersion, imageFull),
    )
  })

  const passivePath =
    record !== null && typeof record.mCharacterPassiveSpell === "string"
      ? record.mCharacterPassiveSpell
      : null
  const passiveRecord = bin !== null && passivePath !== null ? lookupPath(bin, passivePath) : null
  const passiveAbility = buildAbilityFromSpellRecord(
    "P",
    {
      name: entry.passive.name,
      maxrank: 1,
      tooltip: entry.passive.name,
      image: entry.passive.image,
    },
    passiveRecord,
    hashes,
    (imageFull) => ddragonPassiveIconUrl(ddragonVersion, imageFull),
  )

  const emptyAbility = (slot: AbilitySlot): AbilityData => ({
    slot,
    name: "",
    iconUrl: "",
    maxRank: 0,
    castTime: null,
    cooldowns: [],
    dataValues: {},
    calculations: {},
    tooltipRaw: null,
    locKeys: { name: null, tooltip: null, summary: null },
  })

  return {
    id: entry.id,
    key: Number(entry.key),
    name: entry.name,
    title: entry.title,
    roles: [...entry.tags],
    iconUrl: ddragonChampionIconUrl(ddragonVersion, entry.image.full),
    splashUrl: ddragonSplashUrl(entry.id),
    loadingUrl: ddragonLoadingUrl(entry.id),
    stats: buildStats(entry.stats, critDamageMultiplier),
    abilities: {
      P: passiveAbility,
      Q: abilitiesBySlot.Q ?? emptyAbility("Q"),
      W: abilitiesBySlot.W ?? emptyAbility("W"),
      E: abilitiesBySlot.E ?? emptyAbility("E"),
      R: abilitiesBySlot.R ?? emptyAbility("R"),
    },
    modeled,
  }
}
