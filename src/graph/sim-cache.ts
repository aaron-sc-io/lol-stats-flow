import type { ComboStep, Kit, SimResult, TargetSpec } from "@/engine"
import { simulate } from "@/engine"

const CACHE_LIMIT = 200
const cache = new Map<string, SimResult>()
const kitTokens = new WeakMap<Kit, number>()
let nextKitToken = 0

function tokenForKit(kit: Kit): number {
  let token = kitTokens.get(kit)
  if (token === undefined) {
    token = nextKitToken++
    kitTokens.set(kit, token)
  }
  return token
}

function stepsKey(steps: readonly ComboStep[]): string {
  return steps
    .map(
      (step) =>
        `${step.id}:${step.sourceId}:${step.actionId}:${step.rankOverride ?? ""}:${step.delayMs ?? ""}`,
    )
    .join("|")
}

/** Kits are already memoized by `kit-cache.ts` — identical inputs return the
 * exact same object. Tokenizing by identity (rather than re-serializing
 * every stat) means this cache invalidates whenever an itemSet's
 * championId/level/items/ranks actually changed, and only then. */
function kitsKey(kits: Readonly<Record<string, Kit>>): string {
  return Object.keys(kits)
    .sort()
    .map((sourceId) => `${sourceId}:${tokenForKit(kits[sourceId] as Kit)}`)
    .join(",")
}

function targetKey(target: TargetSpec): string {
  return `${target.id}:${target.maxHp}:${target.currentHp ?? ""}:${target.bonusHp}:${target.armor}:${target.magicResist}`
}

/** Memoized `simulate()`, keyed by the step list, the (identity-tokenized)
 * kits it reads, and the target — "combo + its connected kits → per-target
 * SimResult via simulate (memo by step list + kit keys + target)" (plan
 * §5/deliverable 2). Re-simulates only when one of those three actually
 * changed, so reordering steps, editing an item, or tweaking a target stat
 * all invalidate correctly and nothing else does. */
export function getOrSimulate(
  steps: readonly ComboStep[],
  kits: Readonly<Record<string, Kit>>,
  target: TargetSpec,
): SimResult {
  const key = `${stepsKey(steps)}|${kitsKey(kits)}|${targetKey(target)}`
  const cached = cache.get(key)
  if (cached !== undefined) {
    return cached
  }

  const result = simulate({ steps, kits, target })

  if (cache.size >= CACHE_LIMIT) {
    const oldestKey = cache.keys().next().value
    if (oldestKey !== undefined) {
      cache.delete(oldestKey)
    }
  }
  cache.set(key, result)
  return result
}
