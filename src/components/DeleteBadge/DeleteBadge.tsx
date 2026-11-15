import type { ComponentPropsWithoutRef } from "react"
import { cx } from "@/lib/cx"
import styles from "./DeleteBadge.module.css"

export type DeleteBadgeProps = Omit<ComponentPropsWithoutRef<"button">, "type" | "children"> & {
  readonly "aria-label": string
}

/** Small red circle with a black X — the delete affordance pinned to the
 * top-right corner of nodes and target cards. Position it via `className`. */
export function DeleteBadge({ className, ...props }: DeleteBadgeProps) {
  return (
    <button type="button" className={cx(styles.badge, "nodrag", className)} {...props}>
      <svg width="10" height="10" viewBox="0 0 10 10" aria-hidden="true">
        <path d="M2 2L8 8M8 2L2 8" className={styles.cross} />
      </svg>
    </button>
  )
}
