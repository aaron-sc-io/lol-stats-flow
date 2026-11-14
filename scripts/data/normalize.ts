/**
 * Raw cache (`.cache/data/<patch>/`) → versioned snapshot
 * (`data/snapshots/<patch>/{meta,champions,items}.json`). Zod-validates the
 * result; never throws on unknown CDragon shapes (those become `unknown`
 * FormulaNodes / preserved raw hash tokens, counted by `coverage.ts`).
 */
import { join } from "node:path"
import { pathToFileURL } from "node:url"
import { type Snapshot, SnapshotSchema } from "../../src/data/snapshot-schema"
import { parseArgs } from "./cli-args"
import { fetchPatchData } from "./fetch"
import { readJsonFile, readTextFileIfExists, writeJsonFile } from "./fs-cache"
import type { DdragonChampionEntry } from "./normalize/champion"
import { normalizeChampion } from "./normalize/champion"
import { mergeHashTables, parseHashListText } from "./normalize/hash-resolver"
import type { DdragonItemEntry } from "./normalize/item"
import { normalizeItem } from "./normalize/item"
import { MODELED_CHAMPION_KEYS, MODELED_ITEM_IDS } from "./normalize/modeled-roster"
import {
  cdragonCharactersCacheDir,
  cdragonHashesCacheDir,
  currentPointerPath,
  ddragonCacheDir,
  type FetchMeta,
  fetchMetaPath,
  snapshotDir,
} from "./paths"

type ChampionFullFile = { readonly data: Record<string, DdragonChampionEntry> }
type ItemFile = { readonly data: Record<string, DdragonItemEntry> }
type RawBin = Record<string, unknown>

function loadHashes(patch: string) {
  const dir = cdragonHashesCacheDir(patch)
  const files = ["hashes.bintypes.txt", "hashes.binfields.txt", "hashes.binhashes.txt"] as const
  const tables = files.map((file) => {
    const text = readTextFileIfExists(join(dir, file))
    return text !== null ? parseHashListText(text) : null
  })
  return mergeHashTables(tables)
}

function loadChampionBin(patch: string, slug: string): RawBin | null {
  const path = join(cdragonCharactersCacheDir(patch), `${slug}.bin.json`)
  const text = readTextFileIfExists(path)
  return text !== null ? (JSON.parse(text) as RawBin) : null
}

export async function normalizePatch(patch: string): Promise<Snapshot> {
  const meta = readJsonFile<FetchMeta>(fetchMetaPath(patch))
  const championFull = readJsonFile<ChampionFullFile>(
    join(ddragonCacheDir(patch), "championFull.json"),
  )
  const itemFile = readJsonFile<ItemFile>(join(ddragonCacheDir(patch), "item.json"))
  const itemsBin = readJsonFile<RawBin>(
    join(cdragonCharactersCacheDir(patch), "..", "items.cdtb.bin.json"),
  )
  const hashes = loadHashes(patch)

  const champions = Object.values(championFull.data).map((entry) => {
    const slug = meta.championSlugs[entry.id] ?? entry.id.toLowerCase()
    const bin = loadChampionBin(patch, slug)
    const modeled = MODELED_CHAMPION_KEYS.has(Number(entry.key))
    return normalizeChampion(entry, bin, meta.ddragonVersion, hashes, modeled)
  })

  const items = Object.entries(itemFile.data).map(([idString, entry]) => {
    const id = Number(idString)
    const record = (itemsBin[`Items/${id}`] as RawBin | undefined) ?? null
    const modeled = MODELED_ITEM_IDS.has(id)
    return normalizeItem(id, entry, record, meta.ddragonVersion, hashes, modeled)
  })

  const snapshot: Snapshot = {
    meta: {
      snapshotSchemaVersion: 1,
      patch: meta.patch,
      ddragonVersion: meta.ddragonVersion,
      cdragonVersion: meta.cdragonVersion,
      generatedAt: new Date().toISOString(),
    },
    champions,
    items,
  }

  return SnapshotSchema.parse(snapshot)
}

export function writeSnapshot(snapshot: Snapshot): void {
  const dir = snapshotDir(snapshot.meta.patch)
  writeJsonFile(join(dir, "meta.json"), snapshot.meta)
  writeJsonFile(join(dir, "champions.json"), snapshot.champions)
  writeJsonFile(join(dir, "items.json"), snapshot.items)
  writeJsonFile(currentPointerPath(), { patch: snapshot.meta.patch })
}

async function runCli(): Promise<void> {
  const args = parseArgs(process.argv.slice(2))
  let resolvedPatch = args.patch
  if (!args.offline) {
    const result = await fetchPatchData(args.patch, args.force)
    resolvedPatch = result.patch
  } else if (resolvedPatch === "latest") {
    throw new Error(
      '--offline requires an explicit --patch (cannot resolve "latest" without network)',
    )
  }
  const snapshot = await normalizePatch(resolvedPatch)
  writeSnapshot(snapshot)
  console.log(
    `[normalize] wrote snapshot for ${snapshot.meta.patch}: ${snapshot.champions.length} champions, ${snapshot.items.length} items`,
  )
}

const isMainModule =
  process.argv[1] !== undefined && import.meta.url === pathToFileURL(process.argv[1]).href
if (isMainModule) {
  runCli().catch((error) => {
    console.error(error)
    process.exit(1)
  })
}
