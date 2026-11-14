import { fetchTextWithRetry, type RetryOptions } from "./http"

const DDRAGON_BASE = "https://ddragon.leagueoflegends.com"

export type DDragonVersions = readonly string[]

export async function fetchDdragonVersions(retry: RetryOptions): Promise<DDragonVersions> {
  const text = await fetchTextWithRetry(`${DDRAGON_BASE}/api/versions.json`, retry)
  return JSON.parse(text) as DDragonVersions
}

export async function fetchDdragonChampionFull(
  ddragonVersion: string,
  retry: RetryOptions,
): Promise<string> {
  return fetchTextWithRetry(
    `${DDRAGON_BASE}/cdn/${ddragonVersion}/data/en_US/championFull.json`,
    retry,
  )
}

export async function fetchDdragonItems(
  ddragonVersion: string,
  retry: RetryOptions,
): Promise<string> {
  return fetchTextWithRetry(`${DDRAGON_BASE}/cdn/${ddragonVersion}/data/en_US/item.json`, retry)
}

export function ddragonChampionIconUrl(ddragonVersion: string, imageFull: string): string {
  return `${DDRAGON_BASE}/cdn/${ddragonVersion}/img/champion/${imageFull}`
}

export function ddragonSplashUrl(championId: string, skinNum = 0): string {
  return `${DDRAGON_BASE}/cdn/img/champion/splash/${championId}_${skinNum}.jpg`
}

export function ddragonLoadingUrl(championId: string, skinNum = 0): string {
  return `${DDRAGON_BASE}/cdn/img/champion/loading/${championId}_${skinNum}.jpg`
}

export function ddragonSpellIconUrl(ddragonVersion: string, imageFull: string): string {
  return `${DDRAGON_BASE}/cdn/${ddragonVersion}/img/spell/${imageFull}`
}

export function ddragonPassiveIconUrl(ddragonVersion: string, imageFull: string): string {
  return `${DDRAGON_BASE}/cdn/${ddragonVersion}/img/passive/${imageFull}`
}

export function ddragonItemIconUrl(ddragonVersion: string, imageFull: string): string {
  return `${DDRAGON_BASE}/cdn/${ddragonVersion}/img/item/${imageFull}`
}
