import type { AmplifierEffect, DamageType } from "../effects/types"
import type { EvalContext } from "../formula/types"

export type TargetSpec = {
  readonly id: string
  readonly name: string
  readonly maxHp: number
  readonly currentHp?: number
  readonly bonusHp: number
  readonly armor: number
  readonly magicResist: number
}

export type TargetHpState = {
  readonly currentHp: number
  readonly maxHp: number
  readonly bonusHp: number
}

/** One component of damage an action can deal — a `Hit` or `DoT` in effect
 * terms, flattened into "how do I compute raw damage right now". `target`
 * is read at resolve time so `%current/missing HP` effects (Garen R, BotRK,
 * Liandry ticks) always see live state (plan §4.4 requirement). */
export type ActionComponent = {
  readonly id: string
  readonly label: string
  readonly damageType: DamageType
  readonly canCrit: boolean
  readonly compute: (ctx: EvalContext, time: number, target: TargetHpState) => number
  readonly isDot?: { readonly tickIntervalMs: number; readonly ticks: number }
}

export type ActionSlot = "Q" | "W" | "E" | "R" | "AA" | "ITEM"

export type ComboAction = {
  readonly id: string
  readonly label: string
  readonly keyLabel: string
  readonly slot: ActionSlot
  readonly damageType: DamageType
  readonly modeled: boolean
  readonly castTimeMs: number
  readonly rank: number
  /** Combo-step crit variant (plan D9's "E0-E4/crit" style): when true, every
   * `canCrit` component in this action is guaranteed to crit. Steps pick the
   * crit variant explicitly rather than the engine rolling crit chance, so
   * simulation stays deterministic. */
  readonly forceCrit: boolean
  readonly components: readonly ActionComponent[]
}

/** Fired after a source's action lands (before/independent of mitigation),
 * for passive triggers to react to (Vayne W every-3rd, Sheen/Trinity
 * spellblade, Black Cleaver shred, Kraken Slayer every-3rd). */
export type ActionFireEvent = {
  readonly sourceId: string
  readonly action: ComboAction
  readonly time: number
}

export type PassiveTriggerApi = {
  readonly time: number
  readonly ctx: EvalContext
  getTargetState(): TargetHpState
  getBuffCounter(sourceId: string, name: string): number
  setBuffCounter(sourceId: string, name: string, value: number): void
  addResistShred(
    resistType: "armor" | "magicResist",
    amountPerStack: number,
    mode: "flat" | "percent",
  ): void
  armSpellblade(sourceId: string, formula: (ctx: EvalContext) => number): void
  consumeSpellblade(sourceId: string): ((ctx: EvalContext) => number) | null
  /** Arms a persistent `Amplifier` effect for `sourceId`, starting its
   * elapsed-time clock at the moment of this call (e.g. Riftmaker's "damage
   * ramps up the longer you're in combat"). Idempotent calls are the
   * caller's responsibility — arming twice stacks two amplifiers. */
  armAmplifier(sourceId: string, effect: AmplifierEffect): void
  scheduleBonusHit(
    sourceId: string,
    label: string,
    damageType: DamageType,
    raw: number,
    delayMs: number,
  ): void
  scheduleDot(
    sourceId: string,
    label: string,
    damageType: DamageType,
    perTick: (ctx: EvalContext) => number,
    tickIntervalMs: number,
    ticks: number,
  ): void
}

export type PassiveRule = {
  readonly id: string
  readonly appliesTo: (event: ActionFireEvent) => boolean
  readonly effect: (api: PassiveTriggerApi, event: ActionFireEvent) => void
}

export type Kit = {
  readonly sourceId: string
  readonly championId: string | null
  readonly level: number
  readonly ctx: EvalContext
  readonly actions: readonly ComboAction[]
  readonly passiveTriggers: readonly PassiveRule[]
}

export type ComboStep = {
  readonly id: string
  readonly sourceId: string
  readonly actionId: string
  readonly rankOverride?: number
  readonly delayMs?: number
}

export type DamageInstance = {
  readonly time: number
  readonly stepId: string
  readonly sourceId: string
  readonly label: string
  readonly damageType: DamageType
  readonly raw: number
  readonly mitigated: number
  readonly targetHpBefore: number
  readonly targetHpAfter: number
  readonly isTick: boolean
  readonly cause: string
}

export type SimResult = {
  readonly instances: readonly DamageInstance[]
  readonly perStep: Readonly<Record<string, number>>
  readonly totalsByType: Readonly<Record<DamageType, number>>
  readonly killedAt?: { readonly stepId: string; readonly time: number }
  readonly overkill: number
  readonly duration: number
}
