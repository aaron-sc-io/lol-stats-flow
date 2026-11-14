/**
 * Cheap patch-drift check for `patch-sync.yml`'s "detect" step: fetches only
 * `versions.json` (no champion/item/bin downloads) and reports whether it
 * differs from `data/current.json`. Exits with `GITHUB_OUTPUT`-style
 * `key=value` lines on stdout when `--github-output` is passed, so the
 * workflow can `cat $GITHUB_STEP_SUMMARY`-free wire it straight into step
 * outputs without a separate parsing step.
 */
import { pathToFileURL } from "node:url"
import { fetchDdragonVersions } from "./ddragon-client"
import { readJsonFile } from "./fs-cache"
import { DEFAULT_RETRY_OPTIONS } from "./http"
import { currentPointerPath } from "./paths"

export type LatestCheck = {
  readonly current: string
  readonly latest: string
  readonly isNew: boolean
}

export async function checkLatest(): Promise<LatestCheck> {
  const { patch: current } = readJsonFile<{ patch: string }>(currentPointerPath())
  const versions = await fetchDdragonVersions(DEFAULT_RETRY_OPTIONS)
  const latest = versions[0]
  if (latest === undefined) {
    throw new Error("DDragon versions.json returned an empty list")
  }
  return { current, latest, isNew: latest !== current }
}

async function runCli(): Promise<void> {
  const githubOutput = process.argv.includes("--github-output")
  const result = await checkLatest()
  if (githubOutput) {
    console.log(`current=${result.current}`)
    console.log(`latest=${result.latest}`)
    console.log(`is_new=${result.isNew}`)
  } else {
    console.log(JSON.stringify(result, null, 2))
  }
}

const isMainModule =
  process.argv[1] !== undefined && import.meta.url === pathToFileURL(process.argv[1]).href
if (isMainModule) {
  runCli().catch((error) => {
    console.error(error)
    process.exit(1)
  })
}
