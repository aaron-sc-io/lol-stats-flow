import { type ReactNode, useId, useState } from "react"
import { Icon } from "@/components/icons"
import { cx } from "@/lib/cx"
import type { DemoState } from "@/lib/demo-state"
import { demoStateAttr } from "@/lib/demo-state"
import styles from "./Collapsible.module.css"

export type CollapsibleProps = {
  readonly label: ReactNode
  readonly children: ReactNode
  readonly defaultOpen?: boolean | undefined
  /** Controlled open state. Omit to let Collapsible manage it internally. */
  readonly open?: boolean | undefined
  readonly onOpenChange?: ((open: boolean) => void) | undefined
  readonly className?: string | undefined
  /** Visual QA only — see `src/lib/demo-state.ts`. */
  readonly demoState?: DemoState | undefined
}

/**
 * Disclosure section used by the combo node's per-itemSet ability palettes
 * (Phase 4b). Height animates via the CSS grid-rows trick (0fr → 1fr) so no
 * JS measurement is needed, and collapses to instant automatically under
 * `prefers-reduced-motion` since that's handled once, globally, by
 * `--motion-base` (see `tokens.css`).
 */
export function Collapsible({
  label,
  children,
  defaultOpen = false,
  open,
  onOpenChange,
  className,
  demoState,
}: CollapsibleProps) {
  const [internalOpen, setInternalOpen] = useState(defaultOpen)
  const isOpen = open ?? internalOpen
  const contentId = useId()

  function toggle() {
    const next = !isOpen
    if (open === undefined) {
      setInternalOpen(next)
    }
    onOpenChange?.(next)
  }

  return (
    <div className={cx(styles.root, className)}>
      <button
        type="button"
        className={styles.trigger}
        aria-expanded={isOpen}
        aria-controls={contentId}
        onClick={toggle}
        {...demoStateAttr(demoState)}
      >
        <Icon
          name="chevron-right"
          size={16}
          className={cx(styles.chevron, isOpen && styles.chevronOpen)}
        />
        {label}
      </button>
      <div id={contentId} className={styles.region} data-open={isOpen}>
        <div className={styles.inner}>
          <div className={styles.body}>{children}</div>
        </div>
      </div>
    </div>
  )
}
