import type { ComboStep, DamageType, Kit, SimResult, TargetSpec } from "@/engine"
import { computeStepFireTimes, resolveInstanceStepId } from "./step-timing"
import type { XMode } from "./types"

export type ChartPoint = {
  readonly x: number
  readonly xLabel: string
  readonly physical: number
  readonly magic: number
  readonly true: number
  readonly total: number
  readonly cumulative: number
  readonly targetHpAfter: number
  /** The real combo step this point represents — only set in step mode,
   * where it drives the timeline-entry ↔ chart-point cross-highlight
   * (plan §6). Tick-mode points don't map 1:1 onto a single step. */
  readonly stepId?: string
}

function startingHp(target: TargetSpec): number {
  return target.currentHp ?? target.maxHp
}

function emptyDelta(): Record<DamageType, number> {
  return { physical: 0, magic: 0, true: 0 }
}

/** Step mode (plan D10/§6): one point per combo step, with every instance
 * it caused — including passive/DoT damage folded in via
 * `resolveInstanceStepId` — summed into that step's bars. A step with zero
 * instances (e.g. its action fizzled) still renders a flat point. */
function buildStepPoints(
  result: SimResult,
  steps: readonly ComboStep[],
  kits: Readonly<Record<string, Kit>>,
  target: TargetSpec,
): ChartPoint[] {
  const fireTimes = computeStepFireTimes(steps, kits)
  const byStepId = new Map<string, Record<DamageType, number>>()
  const lastHpByStepId = new Map<string, number>()
  for (const instance of result.instances) {
    const stepId = resolveInstanceStepId(instance, fireTimes)
    const bucket = byStepId.get(stepId) ?? emptyDelta()
    bucket[instance.damageType] += instance.mitigated
    byStepId.set(stepId, bucket)
    lastHpByStepId.set(stepId, instance.targetHpAfter)
  }

  let cumulative = 0
  let lastHp = startingHp(target)
  return steps.map((step, index) => {
    const delta = byStepId.get(step.id) ?? emptyDelta()
    const total = delta.physical + delta.magic + delta.true
    cumulative += total
    lastHp = lastHpByStepId.get(step.id) ?? lastHp
    return {
      x: index,
      xLabel: `Step ${index + 1}`,
      ...delta,
      total,
      cumulative,
      targetHpAfter: lastHp,
      stepId: step.id,
    }
  })
}

/** Tick mode (plan D10/§6): every damage instance (including DoT ticks) as
 * its own point on a real-time axis in seconds. `result.instances` is
 * already time-ordered by `simulate()`'s event queue. */
function buildTickPoints(result: SimResult): ChartPoint[] {
  let cumulative = 0
  return result.instances.map((instance) => {
    const delta = emptyDelta()
    delta[instance.damageType] = instance.mitigated
    cumulative += instance.mitigated
    return {
      x: instance.time / 1000,
      xLabel: `${(instance.time / 1000).toFixed(2)}s`,
      ...delta,
      total: instance.mitigated,
      cumulative,
      targetHpAfter: instance.targetHpAfter,
    }
  })
}

export function buildChartPoints(
  result: SimResult,
  steps: readonly ComboStep[],
  kits: Readonly<Record<string, Kit>>,
  target: TargetSpec,
  xMode: XMode,
): readonly ChartPoint[] {
  return xMode === "step" ? buildStepPoints(result, steps, kits, target) : buildTickPoints(result)
}
