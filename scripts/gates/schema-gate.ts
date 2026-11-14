/**
 * Gate 1 — Zod schema validation. Every champion/item in the candidate
 * snapshot must parse against `SnapshotSchema` (plan §3.3.2 bullet 1). The
 * snapshot is already validated once by `normalize.ts` at write time; this
 * gate re-validates the *committed-to-disk* JSON independently, so a gate
 * run against an already-written snapshot (e.g. `--offline` reruns, or CI
 * re-checking a PR) doesn't silently trust the producer.
 */
import { join } from "node:path"
import { SnapshotSchema } from "../../src/data/schema"
import { readJsonFile } from "../data/fs-cache"
import { snapshotDir } from "../data/paths"
import { type GateOutcome, gateFail, gatePass } from "./types"

export function runSchemaGate(patch: string): GateOutcome {
  const dir = snapshotDir(patch)
  let meta: unknown
  let champions: unknown
  let items: unknown
  try {
    meta = readJsonFile(join(dir, "meta.json"))
    champions = readJsonFile(join(dir, "champions.json"))
    items = readJsonFile(join(dir, "items.json"))
  } catch (error) {
    return gateFail("schema", `could not read snapshot files for ${patch}: ${String(error)}`)
  }

  const result = SnapshotSchema.safeParse({ meta, champions, items })
  if (result.success) {
    return gatePass(
      "schema",
      `${result.data.champions.length} champions, ${result.data.items.length} items validated`,
    )
  }
  const issueCount = result.error.issues.length
  const sample = result.error.issues
    .slice(0, 5)
    .map((issue) => `${issue.path.join(".")}: ${issue.message}`)
    .join("; ")
  return gateFail("schema", `${issueCount} Zod validation issue(s): ${sample}`)
}
