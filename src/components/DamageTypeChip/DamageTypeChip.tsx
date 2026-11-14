import type { ReactNode } from "react"
import { cx } from "@/lib/cx"
import styles from "./DamageTypeChip.module.css"

export type DamageType = "physical" | "magic" | "true"

const DAMAGE_TYPE_LABEL: Record<DamageType, string> = {
  physical: "Physical",
  magic: "Magic",
  true: "True",
}

export type DamageTypeChipProps = {
  readonly type: DamageType
  /** The formatted value, e.g. `1,284` — pass a `.num` (tabular) node. */
  readonly children: ReactNode
  readonly className?: string | undefined
}

/**
 * Damage-type indicator used identically in charts, the comparison table,
 * and combo timeline entries (DESIGN.md §6). Color carries the meaning for
 * sighted users with normal color vision; the swatch shape is a redundant
 * cue for color-blind users and greyscale prints:
 *   physical = solid fill, magic = fill + diagonal hatch, true = outline.
 */
export function DamageTypeChip({ type, children, className }: DamageTypeChipProps) {
  return (
    <span className={cx(styles.chip, className)}>
      <span className={styles.swatch} data-type={type} aria-hidden="true" />
      <span className="sr-only">{DAMAGE_TYPE_LABEL[type]}:</span>
      <span className="num">{children}</span>
    </span>
  )
}
