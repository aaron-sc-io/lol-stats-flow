/**
 * Public engine API (plan §4, Phase 2 deliverable). Zero React imports,
 * pure TypeScript, deterministic. Consumed later by the Combo/Graph UI.
 */

export type { DamageType, Effect } from "./effects/types"
export { compile, compileCalculation } from "./formula/compile"
export { type EvalContext, FormulaCompileError } from "./formula/types"
export { type BuildKitParams, buildKit } from "./kit"
export {
  applyMitigation,
  calculateEffectiveResistance,
  calculateMitigatedDamage,
  lethalityToArmorPen,
} from "./mitigation"
export { type SimulateParams, simulate } from "./sim/simulate"
export type {
  ActionComponent,
  ActionFireEvent,
  ActionSlot,
  ComboAction,
  ComboStep,
  DamageCause,
  DamageInstance,
  Kit,
  PassiveRule,
  PassiveTriggerApi,
  SimResult,
  TargetHpState,
  TargetSpec,
} from "./sim/types"
export { growthMultiplier, statsAt } from "./stats/stats-at"
export type { ResolvedStats } from "./stats/types"
