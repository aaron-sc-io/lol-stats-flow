/**
 * Downloads raw DDragon + CDragon JSON for a patch into the gitignored cache
 * dir `.cache/data/<patch>/`. Never mutates `data/` (that's normalize.ts).
 * Run directly via `tsx scripts/data/fetch.ts --patch latest`, or imported by
 * `sync.ts`.
 */
import { join } from "node:path"
import { pathToFileURL } from "node:url"
import {
  fetchCdragonChampionSummary,
  fetchCdragonCharacterBin,
  fetchCdragonHashList,
  fetchCdragonItemsBin,
  resolveCdragonPatchDir,
} from "./cdragon-client"
import { parseArgs } from "./cli-args"
import { fetchDdragonChampionFull, fetchDdragonItems, fetchDdragonVersions } from "./ddragon-client"
import { fileExists, readTextFileIfExists, writeJsonFile, writeTextFile } from "./fs-cache"
import { DEFAULT_RETRY_OPTIONS, runWithConcurrencyLimit } from "./http"
import {
  cdragonCharactersCacheDir,
  cdragonHashesCacheDir,
  ddragonCacheDir,
  type FetchMeta,
  fetchMetaPath,
} from "./paths"

const CHAMPION_FETCH_CONCURRENCY = 6

export type FetchResult = {
  readonly patch: string
  readonly meta: FetchMeta
}

async function resolveDdragonVersion(requestedPatch: string): Promise<string> {
  if (requestedPatch !== "latest") {
    return requestedPatch
  }
  const versions = await fetchDdragonVersions(DEFAULT_RETRY_OPTIONS)
  const latest = versions[0]
  if (latest === undefined) {
    throw new Error("DDragon versions.json returned an empty list")
  }
  return latest
}

type ChampionFullFile = { data: Record<string, { id: string; key: string }> }

async function fetchAllCharacterBins(
  urlPatchDir: string,
  cachePatch: string,
  ddragonChampions: ChampionFullFile,
  aliasBySlug: ReadonlyMap<number, string>,
  force: boolean,
): Promise<Record<string, string>> {
  const slugs: Record<string, string> = {}
  const entries = Object.values(ddragonChampions.data)
  const tasks = entries.map((champion) => async () => {
    const championKey = Number(champion.key)
    const slug = (aliasBySlug.get(championKey) ?? champion.id).toLowerCase()
    slugs[champion.id] = slug
    const cachePath = join(cdragonCharactersCacheDir(cachePatch), `${slug}.bin.json`)
    if (!force && fileExists(cachePath)) {
      return
    }
    try {
      const bin = await fetchCdragonCharacterBin(urlPatchDir, slug, DEFAULT_RETRY_OPTIONS)
      writeTextFile(cachePath, bin)
    } catch (error) {
      console.warn(
        `[fetch] champion bin fetch failed for ${champion.id} (slug=${slug}): ${String(error)}`,
      )
    }
  })
  await runWithConcurrencyLimit(tasks, CHAMPION_FETCH_CONCURRENCY)
  return slugs
}

async function fetchHashLists(patch: string, force: boolean): Promise<void> {
  const dir = cdragonHashesCacheDir(patch)
  const files = ["hashes.bintypes.txt", "hashes.binfields.txt", "hashes.binhashes.txt"] as const
  for (const fileName of files) {
    const cachePath = join(dir, fileName)
    if (!force && fileExists(cachePath)) {
      continue
    }
    const content = await fetchCdragonHashList(fileName, DEFAULT_RETRY_OPTIONS)
    if (content !== null) {
      writeTextFile(cachePath, content)
    } else {
      console.warn(`[fetch] hash list unavailable: ${fileName} (will preserve unresolved hashes)`)
    }
  }
}

export async function fetchPatchData(requestedPatch: string, force: boolean): Promise<FetchResult> {
  const ddragonVersion = await resolveDdragonVersion(requestedPatch)
  const patch = ddragonVersion
  const metaPath = fetchMetaPath(patch)

  if (!force && fileExists(metaPath)) {
    return { patch, meta: JSON.parse(readTextFileIfExists(metaPath) ?? "{}") as FetchMeta }
  }

  const cdragonPatchDir = await resolveCdragonPatchDir(ddragonVersion, DEFAULT_RETRY_OPTIONS)

  const [championFullText, itemsText, championSummary] = await Promise.all([
    fetchDdragonChampionFull(ddragonVersion, DEFAULT_RETRY_OPTIONS),
    fetchDdragonItems(ddragonVersion, DEFAULT_RETRY_OPTIONS),
    fetchCdragonChampionSummary(cdragonPatchDir, DEFAULT_RETRY_OPTIONS),
  ])

  writeTextFile(join(ddragonCacheDir(patch), "championFull.json"), championFullText)
  writeTextFile(join(ddragonCacheDir(patch), "item.json"), itemsText)

  const ddragonChampions = JSON.parse(championFullText) as ChampionFullFile
  const aliasBySlug = new Map(championSummary.map((entry) => [entry.id, entry.alias]))

  const championSlugs = await fetchAllCharacterBins(
    cdragonPatchDir,
    patch,
    ddragonChampions,
    aliasBySlug,
    force,
  )

  const itemsBin = await fetchCdragonItemsBin(cdragonPatchDir, DEFAULT_RETRY_OPTIONS)
  writeTextFile(join(cdragonCharactersCacheDir(patch), "..", "items.cdtb.bin.json"), itemsBin)

  await fetchHashLists(patch, force)

  const meta: FetchMeta = {
    patch,
    ddragonVersion,
    cdragonVersion: cdragonPatchDir,
    fetchedAt: new Date().toISOString(),
    championSlugs,
  }
  writeJsonFile(metaPath, meta)
  return { patch, meta }
}

async function runCli(): Promise<void> {
  const args = parseArgs(process.argv.slice(2))
  const result = await fetchPatchData(args.patch, args.force)
  console.log(
    `[fetch] patch=${result.meta.patch} cdragon=${result.meta.cdragonVersion} cached under .cache/data/${result.patch}/`,
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
