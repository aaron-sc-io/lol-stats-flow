/**
 * Flaky-source tolerance state (plan §3.3.4): a fetch failure should not
 * immediately page anyone — CDragon has documented transient 5xx/522s. The
 * workflow persists `{ consecutiveFailures, lastFailureAt, lastSuccessAt }`
 * as a small JSON file on an orphan branch `patch-sync-state` (chosen over
 * an issue body because it's trivially read/written with plain git, needs
 * no GitHub API parsing, and never clutters the Issues tab) and only opens
 * an issue once `consecutiveFailures` reaches `ALERT_THRESHOLD`.
 *
 * `npm run -s data:sync-state -- --file <path> --event success|failure`
 * mutates the file and prints `should_alert=true|false` for the workflow to
 * branch on.
 */
import { pathToFileURL } from "node:url"
import { readTextFileIfExists, writeJsonFile } from "../data/fs-cache"

export const ALERT_THRESHOLD = 3

export type SyncState = {
  readonly consecutiveFailures: number
  readonly lastFailureAt: string | null
  readonly lastSuccessAt: string | null
}

const EMPTY_STATE: SyncState = { consecutiveFailures: 0, lastFailureAt: null, lastSuccessAt: null }

export function readState(path: string): SyncState {
  const text = readTextFileIfExists(path)
  return text === null ? EMPTY_STATE : (JSON.parse(text) as SyncState)
}

export function recordFailure(path: string): SyncState {
  const prev = readState(path)
  const next: SyncState = {
    consecutiveFailures: prev.consecutiveFailures + 1,
    lastFailureAt: new Date().toISOString(),
    lastSuccessAt: prev.lastSuccessAt,
  }
  writeJsonFile(path, next)
  return next
}

export function recordSuccess(path: string): SyncState {
  const next: SyncState = {
    consecutiveFailures: 0,
    lastFailureAt: null,
    lastSuccessAt: new Date().toISOString(),
  }
  writeJsonFile(path, next)
  return next
}

async function runCli(): Promise<void> {
  const argv = process.argv.slice(2)
  const fileIndex = argv.indexOf("--file")
  const eventIndex = argv.indexOf("--event")
  const file = fileIndex === -1 ? undefined : argv[fileIndex + 1]
  const event = eventIndex === -1 ? undefined : argv[eventIndex + 1]
  if (file === undefined || (event !== "success" && event !== "failure")) {
    throw new Error("Usage: data:sync-state -- --file <path> --event success|failure")
  }
  const state = event === "success" ? recordSuccess(file) : recordFailure(file)
  console.log(`consecutive_failures=${state.consecutiveFailures}`)
  console.log(`should_alert=${state.consecutiveFailures >= ALERT_THRESHOLD}`)
}

const isMainModule =
  process.argv[1] !== undefined && import.meta.url === pathToFileURL(process.argv[1]).href
if (isMainModule) {
  runCli().catch((error) => {
    console.error(error)
    process.exit(1)
  })
}
