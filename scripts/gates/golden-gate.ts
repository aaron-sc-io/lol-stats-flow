/**
 * Gate — golden / reference-evaluator tests (plan §3.3.2: `npm test --
 * src/engine`). Spawned as a subprocess rather than invoking Vitest's API
 * in-process, so a crash/hang in the test runner can't take the gate
 * orchestrator down with it, and so stdout/stderr are trivially captured
 * for the PR body / failure issue.
 */
import { spawnSync } from "node:child_process"
import { type GateOutcome, gateFail, gatePass } from "./types"

const OUTPUT_TAIL_CHARS = 4000

export function runGoldenGate(): GateOutcome {
  const result = spawnSync("npm", ["test", "--", "src/engine", "--reporter=dot"], {
    encoding: "utf8",
    shell: true,
  })
  const output = `${result.stdout ?? ""}${result.stderr ?? ""}`
  const tail = output.length > OUTPUT_TAIL_CHARS ? output.slice(-OUTPUT_TAIL_CHARS) : output
  if (result.status === 0) {
    return gatePass("golden-tests", "`npm test -- src/engine` passed")
  }
  return gateFail(
    "golden-tests",
    `\`npm test -- src/engine\` failed (exit ${result.status}):\n\n\`\`\`\n${tail}\n\`\`\``,
  )
}
