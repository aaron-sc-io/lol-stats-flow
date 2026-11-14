import { join } from "node:path"

/** Root of the gitignored build-time download cache. */
export const CACHE_ROOT = join(process.cwd(), ".cache", "data")

export function patchCacheDir(patch: string): string {
  return join(CACHE_ROOT, patch)
}

export function ddragonCacheDir(patch: string): string {
  return join(patchCacheDir(patch), "ddragon")
}

export function cdragonCacheDir(patch: string): string {
  return join(patchCacheDir(patch), "cdragon")
}

export function cdragonCharactersCacheDir(patch: string): string {
  return join(cdragonCacheDir(patch), "characters")
}

export function cdragonHashesCacheDir(patch: string): string {
  return join(cdragonCacheDir(patch), "hashes")
}

export function fetchMetaPath(patch: string): string {
  return join(patchCacheDir(patch), "fetch-meta.json")
}

export function snapshotDir(patch: string): string {
  return join(process.cwd(), "data", "snapshots", patch)
}

export function currentPointerPath(): string {
  return join(process.cwd(), "data", "current.json")
}

export type FetchMeta = {
  readonly patch: string
  readonly ddragonVersion: string
  readonly cdragonVersion: string
  readonly fetchedAt: string
  readonly championSlugs: Readonly<Record<string, string>>
}
