import { readFileSync } from "node:fs"
import { dirname, join } from "node:path"
import { fileURLToPath } from "node:url"
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

/** `src/engine/__golden__/fixtures/<patch>/` — a minimal, committed extract
 * (5 modeled champions + 13 modeled items) frozen at the patch each
 * `pinned/` golden suite was hand-verified against. Unlike `data/current.json`
 * (which tracks whatever patch `data:sync` last produced, and whose
 * snapshots are pruned to the last 3), this directory is resolved relative
 * to THIS module's own file location, never `process.cwd()` or
 * `data/snapshots/`, so pinned suites stay reproducible forever regardless
 * of patch-sync/pruning (plan §3.3 item 2). */
const fixturesRoot = join(dirname(fileURLToPath(import.meta.url)), "..", "__golden__", "fixtures")

function readJson<T>(path: string): T {
  return JSON.parse(readFileSync(path, "utf8")) as T
}

function loadSnapshotFrom(dir: string): Snapshot {
  const meta = readJson<unknown>(join(dir, "meta.json"))
  const champions = readJson<unknown>(join(dir, "champions.json"))
  const items = readJson<unknown>(join(dir, "items.json"))
  return SnapshotSchema.parse({ meta, champions, items })
}

export function loadSnapshotFixture(): Snapshot {
  const { patch } = readJson<{ patch: string }>(join(dataRoot, "current.json"))
  return loadSnapshotFrom(join(dataRoot, "snapshots", patch))
}

/** Loads the frozen, committed fixture snapshot for `patch` from
 * `src/engine/__golden__/fixtures/<patch>/` — used by `pinned` golden
 * suites (plan §3.3 item 2) whose assertions are hand-verified absolute
 * numbers cited to the wiki for that exact patch. These suites must NEVER
 * read `data/current.json`/`data/snapshots/` — a routine balance patch (new
 * numbers) or snapshot pruning (3-patch retention) would otherwise break a
 * test that is specifically pinned to a point in time. */
export function loadPinnedSnapshotFixture(patch: string): Snapshot {
  return loadSnapshotFrom(join(fixturesRoot, patch))
}
