import type { DamageType } from "../effects/types"
import type { EvalContext } from "../formula/types"
import { calculateMitigatedDamage } from "../mitigation"
import type {
  ActionFireEvent,
  ComboAction,
  ComboStep,
  DamageInstance,
  Kit,
  PassiveTriggerApi,
  SimResult,
  TargetSpec,
} from "./types"

type QueueEvent = {
  readonly time: number
  readonly seq: number
  readonly run: () => void
}

/** A tiny sorted-insert priority queue — simulations here are small (tens to
 * low hundreds of events for a 20-step combo), so O(n) insert is simpler and
 * fast enough to clear the "< 5ms for 20 steps" benchmark. */
class EventQueue {
  private events: QueueEvent[] = []
  private nextSeq = 0

  push(time: number, run: () => void): void {
    const event: QueueEvent = { time, seq: this.nextSeq++, run }
    const index = this.events.findIndex(
      (e) => e.time > event.time || (e.time === event.time && e.seq > event.seq),
    )
    if (index === -1) {
      this.events.push(event)
    } else {
      this.events.splice(index, 0, event)
    }
  }

  popAll(onEach: (event: QueueEvent) => void): void {
    while (this.events.length > 0) {
      const event = this.events.shift()
      if (event !== undefined) {
        onEach(event)
      }
    }
  }
}

type MutableTarget = {
  armor: number
  magicResist: number
  currentHp: number
  readonly maxHp: number
  readonly bonusHp: number
}
type BuffCounters = Map<string, Map<string, number>>
type SpellbladeState = Map<string, (ctx: EvalContext) => number>
type ResistShredState = {
  armor: number
  magicResist: number
  armorPercent: number
  magicResistPercent: number
}

function buildTargetState(spec: TargetSpec): MutableTarget {
  return {
    armor: spec.armor,
    magicResist: spec.magicResist,
    currentHp: spec.currentHp ?? spec.maxHp,
    maxHp: spec.maxHp,
    bonusHp: spec.bonusHp,
  }
}

function hpVariantCtx(target: MutableTarget) {
  return { currentHp: target.currentHp, maxHp: target.maxHp, bonusHp: target.bonusHp }
}

export type SimulateParams = {
  readonly steps: readonly ComboStep[]
  readonly kits: Readonly<Record<string, Kit>>
  readonly target: TargetSpec
}

/** Event-queue damage simulation (plan §4.4). Resolve order per instance:
 * raw → crit → attacker amplifiers → target resist reductions (current
 * state) → penetration → mitigation → apply to HP → post-hit triggers →
 * schedule DoT ticks. `%current/missing HP` reads target state at the
 * moment each instance resolves, including every DoT tick. */
export function simulate(params: SimulateParams): SimResult {
  const { steps, kits, target } = params
  const targetState = buildTargetState(target)
  const queue = new EventQueue()
  const instances: DamageInstance[] = []
  const buffCounters: BuffCounters = new Map()
  const resistShred: ResistShredState = {
    armor: 0,
    magicResist: 0,
    armorPercent: 0,
    magicResistPercent: 0,
  }
  const spellblade: SpellbladeState = new Map()
  let killedAt: { stepId: string; time: number } | undefined
  let overkill = 0

  function counterKey(sourceId: string): Map<string, number> {
    let bySource = buffCounters.get(sourceId)
    if (bySource === undefined) {
      bySource = new Map()
      buffCounters.set(sourceId, bySource)
    }
    return bySource
  }
  function resolveInstance(
    sourceId: string,
    stepId: string,
    label: string,
    damageType: DamageType,
    raw: number,
    time: number,
    isTick: boolean,
    cause: string,
  ): void {
    if (targetState.currentHp <= 0) {
      return
    }
    const kit = kits[sourceId]
    const attackerPen =
      damageType === "physical"
        ? {
            armor: {
              flatPen: kit?.ctx.stats.total.armorPenetrationFlat ?? 0,
              percentPen: kit?.ctx.stats.total.armorPenetrationPercent ?? 0,
              flatReduction: resistShred.armor,
              percentReduction: resistShred.armorPercent,
            },
          }
        : damageType === "magic"
          ? {
              magicResist: {
                flatPen: kit?.ctx.stats.total.magicPenetrationFlat ?? 0,
                percentPen: kit?.ctx.stats.total.magicPenetrationPercent ?? 0,
                flatReduction: resistShred.magicResist,
                percentReduction: resistShred.magicResistPercent,
              },
            }
          : {}
    const { mitigatedDamage } = calculateMitigatedDamage({
      rawDamage: raw,
      damageType,
      target: { armor: targetState.armor, magicResist: targetState.magicResist },
      attackerPen,
    })
    const before = targetState.currentHp
    const after = Math.max(0, before - mitigatedDamage)
    if (after === 0 && before > 0 && killedAt === undefined) {
      killedAt = { stepId, time }
      overkill = mitigatedDamage - before
    }
    targetState.currentHp = after
    instances.push({
      time,
      stepId,
      sourceId,
      label,
      damageType,
      raw,
      mitigated: mitigatedDamage,
      targetHpBefore: before,
      targetHpAfter: after,
      isTick,
      cause,
    })
  }

  function makeApi(time: number, ctx: EvalContext): PassiveTriggerApi {
    return {
      time,
      ctx,
      getTargetState: () => hpVariantCtx(targetState),
      getBuffCounter: (src, name) => counterKey(src).get(name) ?? 0,
      setBuffCounter: (src, name, value) => counterKey(src).set(name, value),
      addResistShred: (resistType, amountPerStack, mode) => {
        if (mode === "percent") {
          resistShred[resistType === "armor" ? "armorPercent" : "magicResistPercent"] +=
            amountPerStack
        } else {
          resistShred[resistType] += amountPerStack
        }
      },
      armSpellblade: (src, formula) => spellblade.set(src, formula),
      consumeSpellblade: (src) => {
        const formula = spellblade.get(src) ?? null
        spellblade.delete(src)
        return formula
      },
      scheduleBonusHit: (src, label, damageType, raw, delayMs) => {
        queue.push(time + delayMs, () =>
          resolveInstance(src, "passive", label, damageType, raw, time + delayMs, false, "passive"),
        )
      },
      scheduleDot: (src, label, damageType, perTick, tickIntervalMs, ticks) => {
        for (let i = 1; i <= ticks; i++) {
          const tickTime = time + i * tickIntervalMs
          queue.push(tickTime, () =>
            resolveInstance(src, "dot", label, damageType, perTick(ctx), tickTime, true, "dot"),
          )
        }
      },
    }
  }

  function fireAction(sourceId: string, stepId: string, action: ComboAction, time: number): void {
    const kit = kits[sourceId]
    if (kit === undefined) {
      throw new Error(`simulate: unknown sourceId "${sourceId}"`)
    }
    const ctx: EvalContext = {
      ...kit.ctx,
      rank: action.rank,
      buffCounters: Object.fromEntries(counterKey(sourceId)),
    }
    const elapsed = time
    for (const component of action.components) {
      const target = hpVariantCtx(targetState)
      const raw0 = component.compute(ctx, elapsed, target)
      const crit =
        component.canCrit && action.forceCrit ? ctx.stats.total.criticalStrikeDamageMultiplier : 1
      const raw = raw0 * crit
      if (component.isDot !== undefined) {
        const { tickIntervalMs, ticks } = component.isDot
        for (let i = 1; i <= ticks; i++) {
          const tickTime = time + i * tickIntervalMs
          queue.push(tickTime, () =>
            resolveInstance(
              sourceId,
              stepId,
              `${action.label} (tick)`,
              component.damageType,
              component.compute(ctx, tickTime, hpVariantCtx(targetState)),
              tickTime,
              true,
              action.id,
            ),
          )
        }
      } else {
        resolveInstance(
          sourceId,
          stepId,
          action.label,
          component.damageType,
          raw,
          time,
          false,
          action.id,
        )
      }
    }
    const fireEvent: ActionFireEvent = { sourceId, action, time }
    const api = makeApi(time, ctx)
    for (const rule of kit.passiveTriggers) {
      if (rule.appliesTo(fireEvent)) {
        rule.effect(api, fireEvent)
      }
    }
  }

  let cursor = 0
  const lastActionTimeBySource = new Map<string, number>()
  for (const step of steps) {
    const kit = kits[step.sourceId]
    if (kit === undefined) {
      throw new Error(`simulate: step "${step.id}" references unknown sourceId "${step.sourceId}"`)
    }
    const action = kit.actions.find((a) => a.id === step.actionId)
    if (action === undefined) {
      throw new Error(`simulate: unknown actionId "${step.actionId}" for source "${step.sourceId}"`)
    }
    const prior = lastActionTimeBySource.get(step.sourceId) ?? cursor
    const fireTime = Math.max(cursor, prior) + (step.delayMs ?? 0)
    cursor = fireTime + action.castTimeMs
    lastActionTimeBySource.set(step.sourceId, fireTime)
    queue.push(fireTime, () => fireAction(step.sourceId, step.id, action, fireTime))
  }

  let duration = 0
  queue.popAll((event) => {
    duration = Math.max(duration, event.time)
    event.run()
  })

  const perStep: Record<string, number> = {}
  const totalsByType: Record<DamageType, number> = { physical: 0, magic: 0, true: 0 }
  for (const instance of instances) {
    perStep[instance.stepId] = (perStep[instance.stepId] ?? 0) + instance.mitigated
    totalsByType[instance.damageType] += instance.mitigated
  }

  return {
    instances,
    perStep,
    totalsByType,
    ...(killedAt !== undefined ? { killedAt } : {}),
    overkill,
    duration,
  }
}
