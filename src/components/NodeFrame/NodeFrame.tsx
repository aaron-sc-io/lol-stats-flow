import { type ControlPosition, NodeResizeControl } from "@xyflow/react"
import type { CSSProperties, ReactNode, Ref } from "react"
import { DeleteBadge } from "@/components/DeleteBadge"
import { DuplicateBadge } from "@/components/DuplicateBadge"
import { cx } from "@/lib/cx"
import styles from "./NodeFrame.module.css"

const CORNER_POSITIONS: readonly ControlPosition[] = ["top-left", "bottom-left", "bottom-right"]

export type NodeFrameResizeConfig = {
  readonly minWidth?: number | undefined
  readonly maxWidth?: number | undefined
  readonly minHeight?: number | undefined
  readonly maxHeight?: number | undefined
  readonly keepAspectRatio?: boolean | undefined
}

export type NodeFrameProps = {
  /** 11px uppercase kicker — e.g. "CHAMPION". */
  readonly label: string
  /** Usually plain text, but a node may embed an inline-editable control
   * (e.g. Combo's rename `<input>`) instead of a static string. */
  readonly title: ReactNode
  readonly actions?: ReactNode
  readonly onDelete?: (() => void) | undefined
  readonly deleteLabel?: string | undefined
  /** Shows the duplicate badge (left of the delete badge) while selected. */
  readonly onDuplicate?: (() => void) | undefined
  readonly resize?: NodeFrameResizeConfig | undefined
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
 * top-right delete affordance, rounded-corner resize brackets on the
 * top-left/bottom-left/bottom-right corners, and the selected/highlighted/
 * dimmed states DESIGN.md §6 requires for the Graph's upstream-path hover
 * highlight.
 */
export function NodeFrame({
  label,
  title,
  actions,
  onDelete,
  deleteLabel,
  onDuplicate,
  resize,
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

  const resolvedDeleteLabel =
    deleteLabel ??
    (typeof title === "string" ? `Delete ${title}` : `Delete ${label.toLowerCase()} node`)

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
      {resize === undefined
        ? null
        : CORNER_POSITIONS.map((position) => (
            <NodeResizeControl
              key={position}
              position={position}
              {...(resize.minWidth === undefined ? {} : { minWidth: resize.minWidth })}
              {...(resize.maxWidth === undefined ? {} : { maxWidth: resize.maxWidth })}
              {...(resize.minHeight === undefined ? {} : { minHeight: resize.minHeight })}
              {...(resize.maxHeight === undefined ? {} : { maxHeight: resize.maxHeight })}
              {...(resize.keepAspectRatio === undefined
                ? {}
                : { keepAspectRatio: resize.keepAspectRatio })}
              autoScale={false}
              className={cx(styles.cornerBracket, styles[`corner_${position.replace("-", "_")}`])}
            />
          ))}
      <div className={styles.header}>
        <div className={styles.headerText}>
          <span className={styles.label}>{label}</span>
          <span className={styles.title}>{title}</span>
        </div>
        {actions === undefined ? null : (
          <div className={cx(styles.actions, "nodrag")}>{actions}</div>
        )}
      </div>
      {selected === true && onDuplicate !== undefined ? (
        <DuplicateBadge onClick={onDuplicate} className={styles.duplicateButton} />
      ) : null}
      {selected === true && onDelete !== undefined ? (
        <DeleteBadge
          aria-label={resolvedDeleteLabel}
          onClick={onDelete}
          className={styles.deleteButton}
        />
      ) : null}
      {children === undefined ? null : <div className={styles.body}>{children}</div>}
    </div>
  )
}
