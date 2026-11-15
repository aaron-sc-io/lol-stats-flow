import type { ComponentPropsWithoutRef } from "react"
import { Icon } from "@/components/icons"
import { Tooltip } from "@/components/Tooltip"
import { cx } from "@/lib/cx"
import styles from "./DuplicateBadge.module.css"

export type DuplicateBadgeProps = Omit<ComponentPropsWithoutRef<"button">, "type" | "children"> & {
  readonly "aria-label"?: string
}

/** Small muted light-blue circle with the copy (two squares) glyph - the
 * duplicate affordance pinned next to `DeleteBadge` on selected nodes.
 * Position it via `className`. */
export function DuplicateBadge({
  className,
  "aria-label": ariaLabel = "Duplicate Node",
  ...props
}: DuplicateBadgeProps) {
  return (
    <Tooltip label="Duplicate Node">
      <button
        type="button"
        aria-label={ariaLabel}
        className={cx(styles.badge, "nodrag", className)}
        {...props}
      >
        <Icon name="copy" size={16} className={styles.glyph} />
      </button>
    </Tooltip>
  )
}
