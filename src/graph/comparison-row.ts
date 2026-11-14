import type { ComboStep, SimResult, TargetSpec } from "@/engine"

export type ComparisonRow = {
  readonly comboId: string
  readonly comboName: string
  readonly variantId: string
  readonly variantName: string
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
 * step/time of kill" column (plan D12). Every `DamageInstance.stepId`
 * (including passive-proc and DoT-tick instances) is the real causing
 * `ComboStep.id` — the engine threads it through directly (`simulate.ts`'s
 * `fireAction`/`makeApi`), so the lethal instance's own `stepId` is always
 * resolvable here with no re-derivation needed. */
function resolveKillStepLabel(result: SimResult, steps: readonly ComboStep[]): string | null {
  const lethalInstance = result.instances.find(
    (instance) => instance.targetHpAfter === 0 && instance.targetHpBefore > 0,
  )
  if (lethalInstance === undefined) {
    return null
  }
  const stepIndex = steps.findIndex((step) => step.id === lethalInstance.stepId)
  return stepIndex >= 0 ? `Step ${stepIndex + 1}` : null
}

/** One comparison-table row (plan D12): total damage, % of target HP,
 * kill y/n with step/time, overkill, duration, DPS, and the phys/magic/true
 * split for one combo item-set variant vs one target — everything derived
 * from a single `SimResult`, never stored. */
export function buildComparisonRow(
  combo: Pick<ComparisonRow, "comboId" | "comboName" | "variantId" | "variantName">,
  target: TargetSpec,
  result: SimResult,
  steps: readonly ComboStep[],
): ComparisonRow {
  const { physical, magic, true: trueDamage } = result.totalsByType
  const total = physical + magic + trueDamage
  const durationSeconds = result.duration / 1000
  return {
    comboId: combo.comboId,
    comboName: combo.comboName,
    variantId: combo.variantId,
    variantName: combo.variantName,
    targetId: target.id,
    targetName: target.name,
    total,
    percentHp: target.maxHp > 0 ? (total / target.maxHp) * 100 : 0,
    killed: result.killedAt !== undefined,
    killStepLabel: result.killedAt === undefined ? null : resolveKillStepLabel(result, steps),
    killTimeSeconds: result.killedAt === undefined ? null : result.killedAt.time / 1000,
    overkill: result.overkill,
    durationSeconds,
    dps: durationSeconds > 0 ? total / durationSeconds : total,
    physical,
    magic,
    true: trueDamage,
  }
}
