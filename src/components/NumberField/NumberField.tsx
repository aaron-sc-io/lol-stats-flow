import {
  type ChangeEvent,
  type FocusEvent,
  type KeyboardEvent,
  useEffect,
  useRef,
  useState,
} from "react"
import { IconButton } from "@/components/IconButton"
import { cx } from "@/lib/cx"
import styles from "./NumberField.module.css"

export type NumberFieldProps = {
  readonly value: number
  readonly onChange: (value: number) => void
  readonly min?: number | undefined
  readonly max?: number | undefined
  readonly step?: number | undefined
  readonly unit?: string | undefined
  readonly compact?: boolean | undefined
  readonly "aria-label": string
  readonly disabled?: boolean | undefined
  readonly className?: string | undefined
}

function clamp(value: number, min: number, max: number): number {
  return Math.min(Math.max(value, min), max)
}

function formatNumber(value: number): string {
  return Number.isFinite(value) ? String(value) : "0"
}

/**
 * Custom number input (DESIGN.md §7/§9 ban native `<input type="number">`'s
 * spinner chrome). Backed by a plain text input — which sidesteps the
 * browser's "focused number input changes value on scroll-wheel" quirk
 * entirely, since there's no native numeric stepping behavior to disable.
 * Free typing is allowed until blur/Enter, when the draft is parsed,
 * clamped, and committed.
 */
export function NumberField({
  value,
  onChange,
  min = -Infinity,
  max = Infinity,
  step = 1,
  unit,
  compact = false,
  "aria-label": ariaLabel,
  disabled = false,
  className,
}: NumberFieldProps) {
  const [draft, setDraft] = useState(() => formatNumber(value))
  const isFocused = useRef(false)

  useEffect(() => {
    if (!isFocused.current) {
      setDraft(formatNumber(value))
    }
  }, [value])

  function commit(nextDraft: string) {
    const parsed = Number.parseFloat(nextDraft)
    const next = Number.isNaN(parsed) ? value : clamp(parsed, min, max)
    setDraft(formatNumber(next))
    if (next !== value) {
      onChange(next)
    }
  }

  function handleChange(event: ChangeEvent<HTMLInputElement>) {
    setDraft(event.target.value)
  }

  function handleFocus() {
    isFocused.current = true
  }

  function handleBlur(event: FocusEvent<HTMLInputElement>) {
    isFocused.current = false
    commit(event.target.value)
  }

  function handleKeyDown(event: KeyboardEvent<HTMLInputElement>) {
    if (event.key === "Enter") {
      commit(draft)
      return
    }
    if (event.key === "ArrowUp") {
      event.preventDefault()
      onChange(clamp(value + step, min, max))
      return
    }
    if (event.key === "ArrowDown") {
      event.preventDefault()
      onChange(clamp(value - step, min, max))
    }
  }

  return (
    <div
      className={cx(styles.root, compact && styles.compact, className)}
      data-disabled={disabled ? "true" : undefined}
      aria-disabled={disabled ? "true" : undefined}
    >
      <IconButton
        icon="minus"
        aria-label="Decrease"
        size={compact ? 20 : 24}
        disabled={disabled || value <= min}
        onClick={() => onChange(clamp(value - step, min, max))}
      />
      <div className={styles.valueWrap}>
        <input
          type="text"
          inputMode="decimal"
          value={draft}
          onChange={handleChange}
          onFocus={handleFocus}
          onBlur={handleBlur}
          onKeyDown={handleKeyDown}
          disabled={disabled}
          aria-label={ariaLabel}
          className={cx("num", styles.input)}
        />
        {unit === undefined ? null : <span className={styles.unit}>{unit}</span>}
      </div>
      <IconButton
        icon="plus"
        aria-label="Increase"
        size={compact ? 20 : 24}
        disabled={disabled || value >= max}
        onClick={() => onChange(clamp(value + step, min, max))}
      />
    </div>
  )
}
