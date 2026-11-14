/**
 * Orchestrator CLI: fetch → normalize → write snapshot → write coverage
 * report, in one invocation. `npm run data:sync -- --patch latest`.
 */
import { pathToFileURL } from "node:url"
import { parseArgs } from "./cli-args"
import { writeCoverageReports } from "./coverage"
import { fetchPatchData } from "./fetch"
import { normalizePatch, writeSnapshot } from "./normalize"

export async function sync(
  requestedPatch: string,
  force: boolean,
  offline: boolean,
): Promise<string> {
  const resolvedPatch = offline
    ? requestedPatch
    : (await fetchPatchData(requestedPatch, force)).patch
  const snapshot = await normalizePatch(resolvedPatch)
  writeSnapshot(snapshot)
  writeCoverageReports(snapshot)
  return snapshot.meta.patch
}

async function runCli(): Promise<void> {
  const args = parseArgs(process.argv.slice(2))
  if (args.offline && args.patch === "latest") {
    throw new Error(
      '--offline requires an explicit --patch (cannot resolve "latest" without network)',
    )
  }
  const patch = await sync(args.patch, args.force, args.offline)
  console.log(`[sync] done: patch=${patch}`)
}

const isMainModule =
  process.argv[1] !== undefined && import.meta.url === pathToFileURL(process.argv[1]).href
if (isMainModule) {
  runCli().catch((error) => {
    console.error(error)
    process.exit(1)
  })
}
