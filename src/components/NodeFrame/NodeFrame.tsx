import type { CSSProperties, ReactNode, Ref } from "react"
import { cx } from "@/lib/cx"
import styles from "./NodeFrame.module.css"

export type NodeFrameProps = {
  /** 11px uppercase kicker — e.g. "CHAMPION". */
  readonly label: string
  /** Usually plain text, but a node may embed an inline-editable control
   * (e.g. Combo's rename `<input>`) instead of a static string. */
  readonly title: ReactNode
  readonly actions?: ReactNode
  readonly selected?: boolean | undefined
  readonly highlighted?: boolean | undefined
  readonly dimmed?: boolean | undefined
  readonly children?: ReactNode
  readonly width?: number | string | undefined
  readonly className?: string | undefined
  /** Extra inline styles merged with the computed `width` style — e.g. the
   * Champion node's `--node-scale` custom property (plan D6). */
  readonly style?: CSSProperties | undefined
  /** Lets a node drive the store's hover-linking (e.g. hovering a Combo
   * highlights the item sets feeding it). */
  readonly onPointerEnter?: (() => void) | undefined
  readonly onPointerLeave?: (() => void) | undefined
  /** The outer frame element — e.g. for a node measuring its own chrome. */
  readonly ref?: Ref<HTMLDivElement> | undefined
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
  style: styleProp,
  onPointerEnter,
  onPointerLeave,
  ref,
}: NodeFrameProps) {
  const style: CSSProperties | undefined =
    width === undefined && styleProp === undefined
      ? undefined
      : { ...(width === undefined ? {} : { width }), ...styleProp }

  return (
    <div
      ref={ref}
      className={cx(styles.frame, className)}
      style={style}
      onPointerEnter={onPointerEnter}
      onPointerLeave={onPointerLeave}
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
