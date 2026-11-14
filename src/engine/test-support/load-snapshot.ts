import { readFileSync } from "node:fs"
import { join } from "node:path"
import type { Snapshot } from "../../data/schema"
import { SnapshotSchema } from "../../data/schema"

/** Node/Vitest-friendly snapshot loader for tests and scripts (the runtime
 * app uses `src/data/loader.ts`'s Vite `import.meta.glob` loader instead —
 * this one reads plain files off disk, which both Vitest and `tsx` resolve
 * without a Vite dev-server transform).
 *
 * Reads `data/current.json` at call time rather than statically importing a
 * hardcoded patch directory, so the golden/structural test suite (run as a
 * gate in `scripts/gates/golden-gate.ts`) always exercises whatever patch
 * `data:sync` just produced — required for patch-sync automation to stay
 * maintenance-free across patches (plan §3.3 Phase 6). `process.cwd()` is
 * safe here: every runner that loads this module (Vitest, tsx scripts) is
 * invoked from the repo root. */
const dataRoot = join(process.cwd(), "data")

function readJson<T>(path: string): T {
  return JSON.parse(readFileSync(path, "utf8")) as T
}

export function loadSnapshotFixture(): Snapshot {
  const { patch } = readJson<{ patch: string }>(join(dataRoot, "current.json"))
  const dir = join(dataRoot, "snapshots", patch)
  const meta = readJson<unknown>(join(dir, "meta.json"))
  const champions = readJson<unknown>(join(dir, "champions.json"))
  const items = readJson<unknown>(join(dir, "items.json"))
  return SnapshotSchema.parse({ meta, champions, items })
}
