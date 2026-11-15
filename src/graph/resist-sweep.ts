import { type ComboStep, type Kit, simulate, type TargetSpec } from "@/engine"
import type { ChartPoint } from "./chart-points"
import type { ResistAxis } from "./types"

export const RESIST_SWEEP_MAX = 400
export const RESIST_SWEEP_STEP = 10

export const KILL_MAP_RESIST_STEP = 20
export const KILL_MAP_HP_ROWS = 24

export function startingHp(target: TargetSpec): number {
  return target.currentHp ?? target.maxHp
}

/** The fraction of the target's `axis` resistance that is bonus — held
 * constant while the sweep varies the total, so bonus-only penetration
 * (Yasuo R crits) scales the way it would on that target archetype. */
export function bonusShare(target: TargetSpec, axis: ResistAxis): number {
  const total = axis === "armor" ? target.armor : target.magicResist
  const bonus = (axis === "armor" ? target.bonusArmor : target.bonusMagicResist) ?? 0
  return total > 0 ? Math.min(1, Math.max(0, bonus / total)) : 0
}

/** `target` with its `axis` resistance set to `resist`, keeping its own
 * bonus share. The other resistance stays at the target's value. */
export function targetAtResist(target: TargetSpec, axis: ResistAxis, resist: number): TargetSpec {
  const bonus = resist * bonusShare(target, axis)
  return axis === "armor"
    ? { ...target, armor: resist, bonusArmor: bonus }
    : { ...target, magicResist: resist, bonusMagicResist: bonus }
}

/** The combo's full post-mitigation output against `target`, not capped at
 * the target's HP — so two builds that both kill still show which one has
 * more margin. */
export function comboDamage(
  steps: readonly ComboStep[],
  kits: Readonly<Record<string, Kit>>,
  target: TargetSpec,
): number {
  const {
    physical,
    magic,
    true: trueDamage,
  } = simulate({
    steps,
    kits,
    target,
    allowOverkill: true,
  }).totalsByType
  return physical + magic + trueDamage
}

/** One point per resist value from 0 to `RESIST_SWEEP_MAX`: `x` is the
 * swept resist, `total` the uncapped damage, `targetHpAfter` the HP left
 * (negative = overkill). */
export function buildResistSweepPoints(
  steps: readonly ComboStep[],
  kits: Readonly<Record<string, Kit>>,
  target: TargetSpec,
  axis: ResistAxis,
): ChartPoint[] {
  const hp = startingHp(target)
  const points: ChartPoint[] = []
  for (let resist = 0; resist <= RESIST_SWEEP_MAX; resist += RESIST_SWEEP_STEP) {
    const result = simulate({
      steps,
      kits,
      target: targetAtResist(target, axis, resist),
      allowOverkill: true,
    })
    const { physical, magic, true: trueDamage } = result.totalsByType
    const total = physical + magic + trueDamage
    points.push({
      x: resist,
      xLabel: `${resist}`,
      physical,
      magic,
      true: trueDamage,
      total,
      cumulative: total,
      targetHpAfter: hp - total,
      instances: [],
    })
  }
  return points
}

export type KillOutcome = "both" | "onlyA" | "onlyB" | "neither"

export type KillMapCell = {
  readonly resist: number
  readonly hp: number
  readonly damageA: number
  readonly damageB: number
  readonly outcome: KillOutcome
}

export type KillMapData = {
  readonly axis: ResistAxis
  readonly resists: readonly number[]
  /** Ascending. */
  readonly hps: readonly number[]
  /** Row-major: `cells[hpIndex * resists.length + resistIndex]`. */
  readonly cells: readonly KillMapCell[]
  readonly bonusShare: number
  /** The reference target the grid's bonus share / other resistance come from. */
  readonly referenceName: string
  /** Each plotted target's own (resist, HP) — where it sits on the map. */
  readonly markers: readonly KillMapMarker[]
}

export type KillMapMarker = {
  readonly id: string
  readonly resist: number
  readonly hp: number
  readonly name: string
}

export type SweepVariant = {
  readonly steps: readonly ComboStep[]
  readonly kits: Readonly<Record<string, Kit>>
}

function killOutcome(killsA: boolean, killsB: boolean): KillOutcome {
  if (killsA && killsB) {
    return "both"
  }
  if (killsA) {
    return "onlyA"
  }
  return killsB ? "onlyB" : "neither"
}

/** HP × resist grid comparing two combo variants: which of them deals at
 * least the cell's HP in post-mitigation damage. Uses the first target's
 * bonus share and other resistance; HP is the grid's, not the target's.
 * Every target is plotted as a marker at its own (resist, HP). */
export function buildKillMap(
  a: SweepVariant,
  b: SweepVariant,
  targets: readonly [TargetSpec, ...TargetSpec[]],
  axis: ResistAxis,
): KillMapData {
  const [target] = targets
  const resists: number[] = []
  for (let resist = 0; resist <= RESIST_SWEEP_MAX; resist += KILL_MAP_RESIST_STEP) {
    resists.push(resist)
  }
  const { currentHp: _currentHp, ...baseTarget } = target
  // Fit the HP axis to where kills can happen: up to 125% of the best
  // build's damage at 0 resist (or the tankiest target's own HP, if higher),
  // so the kill boundary uses the map's full height instead of a sliver of it.
  const zeroResist = targetAtResist(target, axis, 0)
  const peakDamage = Math.max(
    comboDamage(a.steps, a.kits, zeroResist),
    comboDamage(b.steps, b.kits, zeroResist),
  )
  const peakHp = Math.max(...targets.map(startingHp))
  const hpStep = Math.max(
    25,
    Math.ceil(Math.max(peakDamage * 1.25, peakHp * 1.1) / KILL_MAP_HP_ROWS / 25) * 25,
  )
  const hps = Array.from({ length: KILL_MAP_HP_ROWS }, (_, index) => (index + 1) * hpStep)
  const cells: KillMapCell[] = []
  for (const hp of hps) {
    for (const resist of resists) {
      const cellTarget = targetAtResist({ ...baseTarget, maxHp: hp }, axis, resist)
      const damageA = comboDamage(a.steps, a.kits, cellTarget)
      const damageB = comboDamage(b.steps, b.kits, cellTarget)
      cells.push({
        resist,
        hp,
        damageA,
        damageB,
        outcome: killOutcome(damageA >= hp, damageB >= hp),
      })
    }
  }
  return {
    axis,
    resists,
    hps,
    cells,
    bonusShare: bonusShare(target, axis),
    referenceName: target.name,
    markers: targets.map((t) => ({
      id: t.id,
      resist: axis === "armor" ? t.armor : t.magicResist,
      hp: startingHp(t),
      name: t.name,
    })),
  }
}
