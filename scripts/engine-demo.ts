/**
 * Manual QA driver for the Phase 2 damage engine. Run via:
 *   npx tsx scripts/engine-demo.ts
 *
 * Loads the committed 16.22.1 snapshot and prints two tables:
 *   1. Yasuo (L11, Infinity Edge + Kraken Slayer) vs {2000 HP, 80 armor, 50 MR}
 *      running [Q, AA, E(2 stacks), AA✳, Q✳].
 *   2. Brand (L9, Liandry's Torment) vs the same target, showing DoT ticks
 *      interleaved with hits ("Tick mode").
 */
import { readFileSync } from "node:fs"
import { join } from "node:path"
import { SnapshotSchema } from "../src/data/schema"
import { buildKit } from "../src/engine/kit"
import { simulate } from "../src/engine/sim/simulate"
import type { TargetSpec } from "../src/engine/sim/types"

const SNAPSHOT_DIR = join(import.meta.dirname, "..", "data", "snapshots", "16.22.1")

function loadSnapshot() {
  const read = (name: string) => JSON.parse(readFileSync(join(SNAPSHOT_DIR, name), "utf-8"))
  return SnapshotSchema.parse({
    meta: read("meta.json"),
    champions: read("champions.json"),
    items: read("items.json"),
  })
}

function printTable(title: string, instances: ReturnType<typeof simulate>["instances"]) {
  console.log(`\n=== ${title} ===`)
  console.log(
    ["time(ms)", "source", "label", "type", "raw", "mitigated", "hpAfter", "tick"]
      .map((h) => h.padEnd(10))
      .join(""),
  )
  for (const i of instances) {
    console.log(
      [
        i.time.toFixed(0),
        i.sourceId,
        i.label,
        i.damageType,
        i.raw.toFixed(1),
        i.mitigated.toFixed(1),
        i.targetHpAfter.toFixed(1),
        i.isTick ? "tick" : "",
      ]
        .map((c) => String(c).padEnd(10))
        .join(""),
    )
  }
}

function main(): void {
  const snapshot = loadSnapshot()
  const target: TargetSpec = {
    id: "dummy",
    name: "Dummy",
    maxHp: 2000,
    armor: 80,
    magicResist: 50,
    bonusHp: 0,
  }

  const yasuoKit = buildKit(snapshot, {
    championId: "Yasuo",
    level: 11,
    items: ["Infinity Edge", "Kraken Slayer"],
  })
  const yasuoSteps = [
    { id: "s1", sourceId: "Yasuo", actionId: "Q" },
    { id: "s2", sourceId: "Yasuo", actionId: "AA" },
    { id: "s3", sourceId: "Yasuo", actionId: "E-stack2" },
    { id: "s4", sourceId: "Yasuo", actionId: "AA-crit" },
    { id: "s5", sourceId: "Yasuo", actionId: "Q-empowered" },
  ]
  const yasuoResult = simulate({ steps: yasuoSteps, kits: { Yasuo: yasuoKit }, target })
  printTable(
    "Yasuo L11 + Infinity Edge + Kraken Slayer vs {2000 HP, 80 armor, 50 MR}",
    yasuoResult.instances,
  )
  console.log(
    `Total: ${Object.values(yasuoResult.totalsByType)
      .reduce((a, b) => a + b, 0)
      .toFixed(
        1,
      )} | duration=${yasuoResult.duration.toFixed(0)}ms | killedAt=${yasuoResult.killedAt ? JSON.stringify(yasuoResult.killedAt) : "no"}`,
  )

  const brandKit = buildKit(snapshot, {
    championId: "Brand",
    level: 9,
    items: ["Liandry's Torment"],
  })
  const brandSteps = [
    { id: "b1", sourceId: "Brand", actionId: "Q" },
    { id: "b2", sourceId: "Brand", actionId: "W" },
    { id: "b3", sourceId: "Brand", actionId: "E" },
  ]
  const brandResult = simulate({ steps: brandSteps, kits: { Brand: brandKit }, target })
  printTable(
    "Brand L9 + Liandry's Torment vs same target (Tick mode: DoT ticks interleaved)",
    brandResult.instances,
  )
  console.log(
    `Total: ${Object.values(brandResult.totalsByType)
      .reduce((a, b) => a + b, 0)
      .toFixed(
        1,
      )} | duration=${brandResult.duration.toFixed(0)}ms | killedAt=${brandResult.killedAt ? JSON.stringify(brandResult.killedAt) : "no"}`,
  )
}

main()
