import { fetchTextWithRetry, type RetryOptions } from "./http"

const CDRAGON_BASE = "https://raw.communitydragon.org"
/** Alternate mirror for hash lists only — same files, hosted by the
 * CommunityDragon/Data GitHub repo (data fix §3). */
const GITHUB_HASHES_MIRROR_BASE =
  "https://raw.githubusercontent.com/CommunityDragon/Data/master/hashes/lol"

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
 * keys back to names. Tries the primary CDragon mirror first (patient
 * retries, per data fix §3 — CDragon's hash endpoint is known to 522
 * intermittently), then falls back to the CommunityDragon/Data GitHub raw
 * mirror (same files, different host, rarely down at the same time).
 * Returns `null` only if both mirrors fail — callers must tolerate this and
 * fall back to preserving the raw hash (never crash on a missing list). */
export async function fetchCdragonHashList(
  fileName: "hashes.bintypes.txt" | "hashes.binfields.txt" | "hashes.binhashes.txt",
  retry: RetryOptions,
): Promise<string | null> {
  const patientRetry: RetryOptions = {
    ...retry,
    maxAttempts: Math.max(retry.maxAttempts, 8),
    maxDelayMs: Math.max(retry.maxDelayMs, 30_000),
  }
  try {
    return await fetchTextWithRetry(`${CDRAGON_BASE}/data/hashes/lol/${fileName}`, patientRetry)
  } catch (primaryError) {
    try {
      return await fetchTextWithRetry(`${GITHUB_HASHES_MIRROR_BASE}/${fileName}`, {
        ...retry,
        maxAttempts: 3,
      })
    } catch {
      console.warn(
        `[cdragon] hash list "${fileName}" unavailable on both mirrors: ${String(primaryError)}`,
      )
      return null
    }
  }
}
