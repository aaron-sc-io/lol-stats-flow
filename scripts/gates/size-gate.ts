/**
 * Gate — snapshot size budget (plan §3.3.2: "snapshot size budget < 15 MB").
 * Keeps committed JSON from silently bloating the repo/Pages bundle if a
 * patch adds a lot of new content (new champions, VGUs, etc.).
 */
import { readdirSync, statSync } from "node:fs"
import { join } from "node:path"
import { snapshotDir } from "../data/paths"
import { type GateOutcome, gateFail, gatePass } from "./types"

export const SNAPSHOT_SIZE_BUDGET_BYTES = 15 * 1024 * 1024

function dirSizeBytes(dir: string): number {
  let total = 0
  for (const entry of readdirSync(dir, { withFileTypes: true })) {
    const path = join(dir, entry.name)
    total += entry.isDirectory() ? dirSizeBytes(path) : statSync(path).size
  }
  return total
}

export function runSizeGate(patch: string): GateOutcome {
  const dir = snapshotDir(patch)
  let bytes: number
  try {
    bytes = dirSizeBytes(dir)
  } catch (error) {
    return gateFail("size-budget", `could not stat snapshot dir for ${patch}: ${String(error)}`)
  }
  const mb = (bytes / (1024 * 1024)).toFixed(2)
  const budgetMb = (SNAPSHOT_SIZE_BUDGET_BYTES / (1024 * 1024)).toFixed(0)
  if (bytes > SNAPSHOT_SIZE_BUDGET_BYTES) {
    return gateFail("size-budget", `snapshot is ${mb} MB, over the ${budgetMb} MB budget`)
  }
  return gatePass("size-budget", `snapshot is ${mb} MB (budget ${budgetMb} MB)`)
}
