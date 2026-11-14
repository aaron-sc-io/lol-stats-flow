/**
 * Auto-demotion (plan §3.3.3): when gates fail only for specific modeled
 * entities, flip those entities to `modeled: false` in the candidate
 * snapshot, record the override in `data/demotions.json` (so the demotion
 * survives future re-syncs instead of being silently un-done the moment the
 * data looks structurally fine again — a human/issue decides to reinstate),
 * regenerate `coverage.json`/`COVERAGE.md` for the patch, and return the
 * updated list so the caller (`patch-sync.yml`) can re-run `data:gates`.
 *
 * `npm run data:demote -- --patch <p> --entities champion:Briar,item:1234`
 * (also invoked programmatically from the workflow's demotion step via the
 * exported `demoteEntities` so it can pass the exact `FailingEntity[]` a
 * prior gate run produced instead of round-tripping through argv).
 */
import { join } from "node:path"
import { pathToFileURL } from "node:url"
import type { ChampionData, ItemData, Snapshot } from "../../src/data/schema"
import { writeCoverageReports } from "../data/coverage"
import { readJsonFile, writeJsonFile } from "../data/fs-cache"
import { snapshotDir } from "../data/paths"
import type { FailingEntity } from "./types"

export type DemotionRecord = {
  readonly patch: string
  readonly kind: "champion" | "item"
  readonly id: string
  readonly name: string
  readonly reason: string
  readonly demotedAt: string
}

export type DemotionsFile = {
  readonly demotions: readonly DemotionRecord[]
}

const DEMOTIONS_PATH = join(process.cwd(), "data", "demotions.json")

export function readDemotionsFile(): DemotionsFile {
  try {
    return readJsonFile<DemotionsFile>(DEMOTIONS_PATH)
  } catch {
    return { demotions: [] }
  }
}

function writeDemotionsFile(file: DemotionsFile): void {
  writeJsonFile(DEMOTIONS_PATH, file)
}

/** Applies `entities` as `modeled: false` overrides on the patch's
 * already-written `champions.json`/`items.json`, appends to
 * `data/demotions.json`, and rewrites the coverage reports so a subsequent
 * `data:gates` run sees the demoted entities as no-longer-modeled (and thus
 * exempt from the structural/coverage regression checks). Returns the
 * number of entities actually demoted. */
export function demoteEntities(patch: string, entities: readonly FailingEntity[]): number {
  if (entities.length === 0) {
    return 0
  }
  const dir = snapshotDir(patch)
  const championsPath = join(dir, "champions.json")
  const itemsPath = join(dir, "items.json")
  const metaPath = join(dir, "meta.json")

  const champions = readJsonFile<ChampionData[]>(championsPath)
  const items = readJsonFile<ItemData[]>(itemsPath)
  const meta = readJsonFile<Snapshot["meta"]>(metaPath)

  const now = new Date().toISOString()
  const newRecords: DemotionRecord[] = []
  let demotedCount = 0

  for (const entity of entities) {
    if (entity.kind === "champion") {
      const champion = champions.find((c) => c.id === entity.id)
      if (champion?.modeled) {
        champion.modeled = false
        demotedCount++
      }
    } else {
      const item = items.find((i) => String(i.id) === entity.id)
      if (item?.modeled) {
        item.modeled = false
        demotedCount++
      }
    }
    newRecords.push({
      patch,
      kind: entity.kind,
      id: entity.id,
      name: entity.name,
      reason: entity.reason,
      demotedAt: now,
    })
  }

  writeJsonFile(championsPath, champions)
  writeJsonFile(itemsPath, items)

  const existing = readDemotionsFile()
  const existingKeys = new Set(existing.demotions.map((d) => `${d.patch}:${d.kind}:${d.id}`))
  const dedupedNewRecords = newRecords.filter(
    (r) => !existingKeys.has(`${r.patch}:${r.kind}:${r.id}`),
  )
  writeDemotionsFile({ demotions: [...existing.demotions, ...dedupedNewRecords] })

  writeCoverageReports({ meta, champions, items })
  return demotedCount
}

function parseEntitiesArg(value: string): FailingEntity[] {
  return value.split(",").map((pair) => {
    const [kind, id] = pair.split(":")
    if ((kind !== "champion" && kind !== "item") || id === undefined) {
      throw new Error(`invalid --entities entry "${pair}", expected champion:<id> or item:<id>`)
    }
    return { kind, id, name: id, reason: "manual demotion via CLI" }
  })
}

async function runCli(): Promise<void> {
  const argv = process.argv.slice(2)
  const patchIndex = argv.indexOf("--patch")
  const entitiesIndex = argv.indexOf("--entities")
  const patch = patchIndex === -1 ? undefined : argv[patchIndex + 1]
  const entitiesArg = entitiesIndex === -1 ? undefined : argv[entitiesIndex + 1]
  if (patch === undefined || entitiesArg === undefined) {
    throw new Error("Usage: data:demote -- --patch <p> --entities champion:<id>,item:<id>,...")
  }
  const count = demoteEntities(patch, parseEntitiesArg(entitiesArg))
  console.log(`[demote] demoted ${count} entity(ies) on patch ${patch}`)
}

const isMainModule =
  process.argv[1] !== undefined && import.meta.url === pathToFileURL(process.argv[1]).href
if (isMainModule) {
  runCli().catch((error) => {
    console.error(error)
    process.exit(1)
  })
}
