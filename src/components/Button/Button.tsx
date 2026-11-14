import type { ButtonHTMLAttributes, ReactNode } from "react"
import { cx } from "@/lib/cx"
import type { DemoState } from "@/lib/demo-state"
import { demoStateAttr } from "@/lib/demo-state"
import styles from "./Button.module.css"

export type ButtonVariant = "primary" | "secondary" | "ghost" | "danger"

export type ButtonProps = Omit<ButtonHTMLAttributes<HTMLButtonElement>, "type"> & {
  readonly variant?: ButtonVariant | undefined
  readonly children: ReactNode
  readonly type?: "button" | "submit" | "reset" | undefined
  /** Visual QA only — see `src/lib/demo-state.ts`. */
  readonly demoState?: DemoState | undefined
}

/**
 * The only button chrome in the app besides IconButton. `primary` is the
 * single highest-emphasis action per screen (white-on-black, inverted from
 * the rest of the quiet-chrome surface) — DESIGN.md §1.2, §1.7.
 */
export function Button({
  variant = "secondary",
  children,
  className,
  type = "button",
  demoState,
  ...rest
}: ButtonProps) {
  return (
    <button
      type={type}
      className={cx(styles.button, styles[variant], className)}
      {...demoStateAttr(demoState)}
      {...rest}
    >
      {children}
    </button>
  )
}
