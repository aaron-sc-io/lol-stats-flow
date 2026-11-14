import type { ReactNode } from "react"
import { cx } from "@/lib/cx"
import styles from "./Badge.module.css"

export type BadgeProps = {
  readonly children: ReactNode
  readonly className?: string | undefined
}

/** Neutral status pill — e.g. "Not modeled". DESIGN.md §9 bans colored
 * badges, so this is the only badge variant: no props for color/intent. */
export function Badge({ children, className }: BadgeProps) {
  return <span className={cx(styles.badge, className)}>{children}</span>
}
