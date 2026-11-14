import { fetchTextWithRetry, type RetryOptions } from "./http"

const CDRAGON_BASE = "https://raw.communitydragon.org"

export type ChampionSummaryEntry = {
  readonly id: number
  readonly name: string
  readonly alias: string
}

/** Resolves the CDragon patch directory for a DDragon version, e.g. `16.22.1`
 * → `16.22`. Falls back to `latest` only if `latest/content-metadata.json`'s
 * version starts with the same `major.minor` (per plan §3.1 patch mapping). */
export async function resolveCdragonPatchDir(
  ddragonVersion: string,
  retry: RetryOptions,
): Promise<string> {
  const [major, minor] = ddragonVersion.split(".")
  const majorMinor = `${major}.${minor}`
  try {
    await fetchTextWithRetry(`${CDRAGON_BASE}/${majorMinor}/content-metadata.json`, {
      ...retry,
      maxAttempts: 2,
    })
    return majorMinor
  } catch {
    const latestMeta = await fetchTextWithRetry(
      `${CDRAGON_BASE}/latest/content-metadata.json`,
      retry,
    )
    const parsed = JSON.parse(latestMeta) as { version?: string }
    if (parsed.version?.startsWith(majorMinor)) {
      return "latest"
    }
    throw new Error(
      `CDragon has no "${majorMinor}" patch directory and "latest" is on a different patch (${parsed.version ?? "unknown"})`,
    )
  }
}

export async function fetchCdragonChampionSummary(
  patchDir: string,
  retry: RetryOptions,
): Promise<ChampionSummaryEntry[]> {
  const text = await fetchTextWithRetry(
    `${CDRAGON_BASE}/${patchDir}/plugins/rcp-be-lol-game-data/global/default/v1/champion-summary.json`,
    retry,
  )
  return JSON.parse(text) as ChampionSummaryEntry[]
}

export async function fetchCdragonCharacterBin(
  patchDir: string,
  slug: string,
  retry: RetryOptions,
): Promise<string> {
  return fetchTextWithRetry(
    `${CDRAGON_BASE}/${patchDir}/game/data/characters/${slug}/${slug}.bin.json`,
    retry,
  )
}

export async function fetchCdragonItemsBin(patchDir: string, retry: RetryOptions): Promise<string> {
  return fetchTextWithRetry(`${CDRAGON_BASE}/${patchDir}/game/items.cdtb.bin.json`, retry)
}

/** Best-effort: CDragon's published hash lists let us resolve some `{hash}`
 * keys back to names. Returns `null` on failure — callers must tolerate this
 * and fall back to preserving the raw hash (never crash on a missing list). */
export async function fetchCdragonHashList(
  fileName: "hashes.bintypes.txt" | "hashes.binfields.txt" | "hashes.binhashes.txt",
  retry: RetryOptions,
): Promise<string | null> {
  try {
    return await fetchTextWithRetry(`${CDRAGON_BASE}/data/hashes/lol/${fileName}`, {
      ...retry,
      maxAttempts: 3,
    })
  } catch {
    return null
  }
}
