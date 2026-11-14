import { forwardRef, type MouseEvent } from "react"
import { Icon, type IconName } from "@/components/icons"
import { Tooltip } from "@/components/Tooltip"
import { cx } from "@/lib/cx"
import type { DemoState } from "@/lib/demo-state"
import { demoStateAttr } from "@/lib/demo-state"
import styles from "./IconButton.module.css"

export type IconButtonSize = 24 | 28 | 32
export type IconButtonVariant = "ghost" | "subtle"

const ICON_SIZE_FOR_BUTTON: Record<IconButtonSize, 16 | 20 | 24> = {
  24: 16,
  28: 20,
  32: 20,
}

export type IconButtonProps = {
  readonly icon: IconName
  /** Required: doubles as the accessible name and the Tooltip label. */
  readonly "aria-label": string
  readonly size?: IconButtonSize | undefined
  readonly variant?: IconButtonVariant | undefined
  readonly disabled?: boolean | undefined
  readonly onClick?: ((event: MouseEvent<HTMLButtonElement>) => void) | undefined
  readonly className?: string | undefined
  readonly type?: "button" | "submit" | undefined
  /** Visual QA only — see `src/lib/demo-state.ts`. */
  readonly demoState?: DemoState | undefined
}

/**
 * Icon-only control with a built-in text tooltip (DESIGN.md requires every
 * icon-only affordance to also expose a text label — `IconButton` makes the
 * accessible-name/tooltip pairing the default instead of something callers
 * can forget).
 */
export const IconButton = forwardRef<HTMLButtonElement, IconButtonProps>(function IconButton(
  {
    icon,
    "aria-label": ariaLabel,
    size = 28,
    variant = "ghost",
    disabled = false,
    onClick,
    className,
    type = "button",
    demoState,
  },
  ref,
) {
  return (
    <Tooltip label={ariaLabel}>
      <button
        ref={ref}
        type={type}
        aria-label={ariaLabel}
        disabled={disabled}
        onClick={onClick}
        className={cx(styles.button, styles[variant], className)}
        style={{ width: size, height: size }}
        {...demoStateAttr(demoState)}
      >
        <Icon name={icon} size={ICON_SIZE_FOR_BUTTON[size]} />
      </button>
    </Tooltip>
  )
})
