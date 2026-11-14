import type { ComboStep, DamageInstance, Kit } from "@/engine"

export type StepFireTime = { readonly sourceId: string; readonly fireTime: number }

/**
 * Independently replays `simulate()`'s scheduling arithmetic (simulate.ts's
 * `cursor`/`lastActionTimeBySource` loop — scheduling only, no damage math)
 * to recover each step's fire time. Needed because `DamageInstance.stepId`
 * is only ever the real step id for an action's own direct hits; every
 * passive-triggered bonus hit or DoT tick (Liandry's burn, Darius's bleed,
 * Black Cleaver/Kraken/spellblade procs — everything that goes through
 * `PassiveTriggerApi.scheduleBonusHit`/`scheduleDot`) is recorded with the
 * literal `stepId` `"passive"` or `"dot"` instead (see `src/engine/sim/
 * simulate.ts`'s `makeApi`) — a real engine gap, documented in the Phase 3
 * report rather than patched in `src/engine/**`, which this module works
 * around for charting/table purposes only.
 */
export function computeStepFireTimes(
  steps: readonly ComboStep[],
  kits: Readonly<Record<string, Kit>>,
): ReadonlyMap<string, StepFireTime> {
  const fireTimes = new Map<string, StepFireTime>()
  let cursor = 0
  const lastActionTimeBySource = new Map<string, number>()

  for (const step of steps) {
    const kit = kits[step.sourceId]
    const action = kit?.actions.find((candidate) => candidate.id === step.actionId)
    if (kit === undefined || action === undefined) {
      continue
    }
    const prior = lastActionTimeBySource.get(step.sourceId) ?? cursor
    const fireTime = Math.max(cursor, prior) + (step.delayMs ?? 0)
    cursor = fireTime + action.castTimeMs
    lastActionTimeBySource.set(step.sourceId, fireTime)
    fireTimes.set(step.id, { sourceId: step.sourceId, fireTime })
  }
  return fireTimes
}

const UNATTRIBUTED_STEP_IDS: ReadonlySet<string> = new Set(["passive", "dot"])

/** Resolves the real combo step that produced `instance`, folding
 * passive/DoT-sourced damage into the step that triggered it: the latest
 * step from the same `sourceId` whose fire time is at or before the
 * instance's time. Falls back to the instance's own `stepId` (still
 * `"passive"`/`"dot"`) if no candidate step is found. */
export function resolveInstanceStepId(
  instance: DamageInstance,
  stepFireTimes: ReadonlyMap<string, StepFireTime>,
): string {
  if (!UNATTRIBUTED_STEP_IDS.has(instance.stepId)) {
    return instance.stepId
  }
  let bestStepId: string | undefined
  let bestFireTime = Number.NEGATIVE_INFINITY
  for (const [stepId, info] of stepFireTimes) {
    if (
      info.sourceId === instance.sourceId &&
      info.fireTime <= instance.time &&
      info.fireTime > bestFireTime
    ) {
      bestStepId = stepId
      bestFireTime = info.fireTime
    }
  }
  return bestStepId ?? instance.stepId
}
