import type { CSSProperties, ReactNode } from "react"
import { cx } from "@/lib/cx"
import styles from "./NodeFrame.module.css"

export type NodeFrameProps = {
  /** 11px uppercase kicker — e.g. "CHAMPION". */
  readonly label: string
  readonly title: string
  readonly actions?: ReactNode
  readonly selected?: boolean | undefined
  readonly highlighted?: boolean | undefined
  readonly dimmed?: boolean | undefined
  readonly children?: ReactNode
  readonly width?: number | string | undefined
  readonly className?: string | undefined
}

/**
 * Generic node shell shared by every node type (Champion/Combo/Graph,
 * Phase 4b): surface, hairline border, header with label/title/actions,
 * and the selected/highlighted/dimmed states DESIGN.md §6 requires for the
 * Graph's upstream-path hover highlight. Domain nodes compose this with
 * their own body content and `<Handle>`s — it owns no React Flow node
 * logic itself.
 */
export function NodeFrame({
  label,
  title,
  actions,
  selected,
  highlighted,
  dimmed,
  children,
  width,
  className,
}: NodeFrameProps) {
  const style: CSSProperties | undefined = width === undefined ? undefined : { width }

  return (
    <div
      className={cx(styles.frame, className)}
      style={style}
      data-selected={selected === true ? "true" : undefined}
      data-highlighted={highlighted === true ? "true" : undefined}
      data-dimmed={dimmed === true ? "true" : undefined}
    >
      <div className={styles.header}>
        <div className={styles.headerText}>
          <span className={styles.label}>{label}</span>
          <span className={styles.title}>{title}</span>
        </div>
        {actions === undefined ? null : <div className={styles.actions}>{actions}</div>}
      </div>
      {children === undefined ? null : <div className={styles.body}>{children}</div>}
    </div>
  )
}
