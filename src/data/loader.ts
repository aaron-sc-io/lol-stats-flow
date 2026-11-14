import type { Snapshot } from "./schema"
import {
  findChampion,
  findItem,
  listChampions as listChampionsOf,
  listItems as listItemsOf,
  validateSnapshotInDev,
} from "./snapshot-selectors"

/**
 * Runtime snapshot loader. Per plan D2 ("no runtime dependency on CDragon"),
 * this only ever reads same-origin, build-time-committed JSON under
 * `data/snapshots/<patch>/`. Uses `import.meta.glob`'s lazy (dynamic-import)
 * form so the snapshot is code-split into its own chunk — never pulled into
 * the main bundle — and Vite resolves the deployed base path
 * (`/lol-stats-flow/`) for us automatically, the same way it does for any
 * other dynamically imported asset.
 */

const currentPointerModules = import.meta.glob<{ default: { patch: string } }>(
  "../../data/current.json",
)
const metaModules = import.meta.glob<{ default: unknown }>("../../data/snapshots/*/meta.json")
const championsModules = import.meta.glob<{ default: unknown }>(
  "../../data/snapshots/*/champions.json",
)
const itemsModules = import.meta.glob<{ default: unknown }>("../../data/snapshots/*/items.json")

function moduleForPatch<T>(
  modules: Record<string, () => Promise<{ default: T }>>,
  patch: string,
): (() => Promise<{ default: T }>) | undefined {
  const entry = Object.entries(modules).find(([path]) => path.includes(`/${patch}/`))
  return entry?.[1]
}

async function loadCurrentPatch(): Promise<string> {
  const [, loader] = Object.entries(currentPointerModules)[0] ?? []
  if (loader === undefined) {
    throw new Error("data/current.json is missing — run `npm run data:sync` first")
  }
  const module = await loader()
  return module.default.patch
}

let snapshotPromise: Promise<Snapshot> | null = null

/** One memoized promise per patch, shared by `getSnapshot()` (the
 * "current patch" case) and `getSnapshotForPatch()` (the patch-pin case,
 * `src/persistence/`) — resolving "current" to a concrete patch and
 * delegating here means the two never double-fetch the same snapshot. */
const snapshotByPatch = new Map<string, Promise<Snapshot>>()

async function loadSnapshotForPatch(patch: string): Promise<Snapshot> {
  const metaLoader = moduleForPatch(metaModules, patch)
  const championsLoader = moduleForPatch(championsModules, patch)
  const itemsLoader = moduleForPatch(itemsModules, patch)
  if (metaLoader === undefined || championsLoader === undefined || itemsLoader === undefined) {
    throw new Error(`No committed snapshot found for patch "${patch}"`)
  }
  const [meta, champions, items] = await Promise.all([
    metaLoader().then((m) => m.default),
    championsLoader().then((m) => m.default),
    itemsLoader().then((m) => m.default),
  ])
  const snapshot = { meta, champions, items } as Snapshot
  return validateSnapshotInDev(snapshot, import.meta.env.DEV)
}

/** Loads (and memoizes) the snapshot for one specific patch, regardless of
 * which patch the app currently considers "current" — the loader-level
 * half of per-canvas patch pin (plan D14 deliverable 2: "loader must
 * support loading a specific patch"). Rejects if that patch was never
 * committed or has since been pruned; callers (`src/persistence/patch-
 * pin.ts` via `decidePatchPin`) check `listAvailablePatches()` first and
 * only call this for a patch already known to be shipped. */
export function getSnapshotForPatch(patch: string): Promise<Snapshot> {
  let promise = snapshotByPatch.get(patch)
  if (promise === undefined) {
    promise = loadSnapshotForPatch(patch)
    snapshotByPatch.set(patch, promise)
  }
  return promise
}

/** Every patch with a committed snapshot under `data/snapshots/<patch>/`
 * — derived from `import.meta.glob`'s matched *paths* (no network/import
 * cost; the glob already enumerated them eagerly at build time). How many
 * patches are actually present (plan §3.3.6's "keep last N=3") is a
 * build-time/CI retention policy (Phase 6), not something this function
 * enforces — it simply reports whatever is on disk. */
export function listAvailablePatches(): readonly string[] {
  const patches = new Set<string>()
  for (const path of Object.keys(championsModules)) {
    const match = /\/snapshots\/([^/]+)\/champions\.json$/.exec(path)
    const patch = match?.[1]
    if (patch !== undefined) {
      patches.add(patch)
    }
  }
  return [...patches].sort()
}

export function getCurrentPatchString(): Promise<string> {
  return loadCurrentPatch()
}

async function loadSnapshotOnce(): Promise<Snapshot> {
  const patch = await loadCurrentPatch()
  return getSnapshotForPatch(patch)
}

/** Exported for the graph derivation layer (`src/graph/`), which needs the
 * full `Snapshot` object to call the engine's `buildKit`/`simulate` — the
 * narrower `getChampion`/`listChampions`/`getItem`/`listItems` helpers below
 * only expose single-entity lookups. Still the same memoized singleton
 * promise, so calling this alongside the helpers never double-fetches. */
export function getSnapshot(): Promise<Snapshot> {
  snapshotPromise ??= loadSnapshotOnce()
  return snapshotPromise
}

export async function getChampion(id: string) {
  return findChampion(await getSnapshot(), id)
}

export async function listChampions() {
  return listChampionsOf(await getSnapshot())
}

export async function getItem(id: number) {
  return findItem(await getSnapshot(), id)
}

export async function listItems() {
  return listItemsOf(await getSnapshot())
}
