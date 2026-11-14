import type { ComboStep, DamageInstance, DamageType, SimResult, TargetSpec } from "@/engine"
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
  /** Every damage instance folded into this point (plan §6/DESIGN.md §6:
   * "Mixed steps use the dominant type, and the tooltip shows the full
   * breakdown") — a single instance in tick mode, one-or-more in step mode
   * (a hit plus the DoT ticks or passive procs it caused). */
  readonly instances: readonly DamageInstance[]
}

/** The damage type that dominates a point's mitigated-damage split —
 * physical/magic/true ties resolve in that same priority order. Drives
 * both the combo-timeline entry chip (`TimelineEntry`) and mixed-step line
 * segment coloring (`ColoredLineSeries`) with one shared rule, per
 * DESIGN.md §6's "the same damage-type encoding is used everywhere". */
export function dominantDamageType(point: ChartPoint): DamageType {
  if (point.physical >= point.magic && point.physical >= point.true) {
    return "physical"
  }
  return point.magic >= point.true ? "magic" : "true"
}

function startingHp(target: TargetSpec): number {
  return target.currentHp ?? target.maxHp
}

function emptyDelta(): Record<DamageType, number> {
  return { physical: 0, magic: 0, true: 0 }
}

/** Step mode (plan D10/§6): one point per combo step, with every instance
 * it caused — including passive/DoT damage, since `DamageInstance.stepId`
 * is always the real causing step (the engine threads it through directly,
 * never a placeholder) — summed into that step's bars. A step with zero
 * instances (e.g. its action fizzled) still renders a flat point. */
function buildStepPoints(
  result: SimResult,
  steps: readonly ComboStep[],
  target: TargetSpec,
): ChartPoint[] {
  const byStepId = new Map<string, Record<DamageType, number>>()
  const instancesByStepId = new Map<string, DamageInstance[]>()
  const lastHpByStepId = new Map<string, number>()
  for (const instance of result.instances) {
    const bucket = byStepId.get(instance.stepId) ?? emptyDelta()
    bucket[instance.damageType] += instance.mitigated
    byStepId.set(instance.stepId, bucket)
    const instanceList = instancesByStepId.get(instance.stepId) ?? []
    instanceList.push(instance)
    instancesByStepId.set(instance.stepId, instanceList)
    lastHpByStepId.set(instance.stepId, instance.targetHpAfter)
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
      instances: instancesByStepId.get(step.id) ?? [],
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
      instances: [instance],
    }
  })
}

export function buildChartPoints(
  result: SimResult,
  steps: readonly ComboStep[],
  target: TargetSpec,
  xMode: XMode,
): readonly ChartPoint[] {
  return xMode === "step" ? buildStepPoints(result, steps, target) : buildTickPoints(result)
}
