// Parses `.patch-sync/summary.json` (written by scripts/gates/patch-sync-run.ts)
// into clean `$GITHUB_OUTPUT` lines. A dedicated step so the orchestrator's
// own stdout (fetch/normalize logs) never has to be grepped for outputs.
import { appendFileSync, readFileSync } from "node:fs"

const summary = JSON.parse(readFileSync(".patch-sync/summary.json", "utf8"))
const lines = Object.entries({
  outcome: summary.outcome,
  current: summary.current,
  target: summary.target,
  demoted_count: summary.demotions.length,
})
  .map(([key, value]) => `${key}=${value}\n`)
  .join("")

const outputFile = process.env.GITHUB_OUTPUT
if (outputFile === undefined) {
  console.log(lines)
} else {
  appendFileSync(outputFile, lines)
}
