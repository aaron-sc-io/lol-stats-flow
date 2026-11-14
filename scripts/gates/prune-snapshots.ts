/**
 * Retention: keep only the last `KEEP_COUNT` snapshots under
 * `data/snapshots/` (plan §3.3.2 "keep only the last 3 snapshots ... update
 * loader manifest"). `src/data/loader.ts#listAvailablePatches` has no
 * separate manifest file to edit — it derives the list from
 * `import.meta.glob`'s matched paths at build time, so deleting a
 * directory here *is* the manifest update; nothing else to touch.
 *
 * "Last" = patch directories sorted by semver-ish numeric comparison of the
 * DDragon version string (`16.22.1` etc.), falling back to the directory's
 * mtime for ties/malformed names. The current patch (from
 * `data/current.json`) is always kept regardless of ordering.
 */
import { readdirSync, rmSync, statSync } from "node:fs"
import { join } from "node:path"
import { pathToFileURL } from "node:url"
import { readJsonFile } from "../data/fs-cache"
import { currentPointerPath } from "../data/paths"

export const KEEP_COUNT = 3

function snapshotsRoot(): string {
  return join(process.cwd(), "data", "snapshots")
}

function comparePatches(a: string, b: string): number {
  const partsA = a.split(".").map(Number)
  const partsB = b.split(".").map(Number)
  for (let i = 0; i < Math.max(partsA.length, partsB.length); i++) {
    const diff = (partsA[i] ?? 0) - (partsB[i] ?? 0)
    if (diff !== 0 && !Number.isNaN(diff)) {
      return diff
    }
  }
  return statSync(join(snapshotsRoot(), a)).mtimeMs - statSync(join(snapshotsRoot(), b)).mtimeMs
}

export function prunedSnapshots(): { kept: readonly string[]; removed: readonly string[] } {
  const root = snapshotsRoot()
  const all = readdirSync(root, { withFileTypes: true })
    .filter((e) => e.isDirectory())
    .map((e) => e.name)
    .sort(comparePatches)

  const current = readJsonFile<{ patch: string }>(currentPointerPath()).patch
  const withoutCurrent = all.filter((p) => p !== current)
  const keepOthers = Math.max(0, KEEP_COUNT - 1)
  const kept = new Set([current, ...withoutCurrent.slice(-keepOthers)])
  const removed = all.filter((p) => !kept.has(p))

  for (const patch of removed) {
    rmSync(join(root, patch), { recursive: true, force: true })
  }

  return { kept: [...kept].sort(comparePatches), removed }
}

async function runCli(): Promise<void> {
  const { kept, removed } = prunedSnapshots()
  console.log(`[prune-snapshots] kept: ${kept.join(", ")}`)
  console.log(
    removed.length > 0
      ? `[prune-snapshots] removed: ${removed.join(", ")}`
      : "[prune-snapshots] nothing to remove",
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
