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

async function loadSnapshot(): Promise<Snapshot> {
  const patch = await loadCurrentPatch()
  const metaLoader = moduleForPatch(metaModules, patch)
  const championsLoader = moduleForPatch(championsModules, patch)
  const itemsLoader = moduleForPatch(itemsModules, patch)
  if (metaLoader === undefined || championsLoader === undefined || itemsLoader === undefined) {
    throw new Error(`No committed snapshot found for current patch "${patch}"`)
  }
  const [meta, champions, items] = await Promise.all([
    metaLoader().then((m) => m.default),
    championsLoader().then((m) => m.default),
    itemsLoader().then((m) => m.default),
  ])
  const snapshot = { meta, champions, items } as Snapshot
  return validateSnapshotInDev(snapshot, import.meta.env.DEV)
}

function getSnapshot(): Promise<Snapshot> {
  snapshotPromise ??= loadSnapshot()
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
