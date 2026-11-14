import type { ComboStep, Kit, SimResult, TargetSpec } from "@/engine"
import { computeStepFireTimes, resolveInstanceStepId } from "./step-timing"

export type ComparisonRow = {
  readonly comboId: string
  readonly comboName: string
  readonly targetId: string
  readonly targetName: string
  readonly total: number
  readonly percentHp: number
  readonly killed: boolean
  readonly killStepLabel: string | null
  readonly killTimeSeconds: number | null
  readonly overkill: number
  readonly durationSeconds: number
  readonly dps: number
  readonly physical: number
  readonly magic: number
  readonly true: number
}

/** Resolves which combo step actually landed the kill, for the "kill y/n +
 * step/time of kill" column (plan D12). `killedAt.stepId` inherits the same
 * `"passive"`/`"dot"` placeholder gap as every other instance — the lethal
 * instance itself (the one unique instance whose HP crossed to zero) is
 * what actually carries a resolvable `sourceId`. */
function resolveKillStepLabel(
  result: SimResult,
  steps: readonly ComboStep[],
  kits: Readonly<Record<string, Kit>>,
): string | null {
  const lethalInstance = result.instances.find(
    (instance) => instance.targetHpAfter === 0 && instance.targetHpBefore > 0,
  )
  if (lethalInstance === undefined) {
    return null
  }
  const fireTimes = computeStepFireTimes(steps, kits)
  const realStepId = resolveInstanceStepId(lethalInstance, fireTimes)
  const stepIndex = steps.findIndex((step) => step.id === realStepId)
  return stepIndex >= 0 ? `Step ${stepIndex + 1}` : null
}

/** One comparison-table row (plan D12): total damage, % of target HP,
 * kill y/n with step/time, overkill, duration, DPS, and the phys/magic/true
 * split — everything derived from a single `SimResult`, never stored. */
export function buildComparisonRow(
  comboId: string,
  comboName: string,
  target: TargetSpec,
  result: SimResult,
  steps: readonly ComboStep[],
  kits: Readonly<Record<string, Kit>>,
): ComparisonRow {
  const { physical, magic, true: trueDamage } = result.totalsByType
  const total = physical + magic + trueDamage
  const durationSeconds = result.duration / 1000
  return {
    comboId,
    comboName,
    targetId: target.id,
    targetName: target.name,
    total,
    percentHp: target.maxHp > 0 ? (total / target.maxHp) * 100 : 0,
    killed: result.killedAt !== undefined,
    killStepLabel: result.killedAt === undefined ? null : resolveKillStepLabel(result, steps, kits),
    killTimeSeconds: result.killedAt === undefined ? null : result.killedAt.time / 1000,
    overkill: result.overkill,
    durationSeconds,
    dps: durationSeconds > 0 ? total / durationSeconds : total,
    physical,
    magic,
    true: trueDamage,
  }
}
