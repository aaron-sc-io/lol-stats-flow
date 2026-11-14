import {
  type KeyboardEvent as ReactKeyboardEvent,
  type PointerEvent as ReactPointerEvent,
  useRef,
} from "react"
import { cx } from "@/lib/cx"
import styles from "./Slider.module.css"

export type SliderProps = {
  readonly value: number
  readonly min: number
  readonly max: number
  readonly step?: number | undefined
  readonly onChange: (value: number) => void
  readonly "aria-label": string
  readonly disabled?: boolean | undefined
  /** Formats the `.num` value label — defaults to the raw number. */
  readonly formatValue?: ((value: number) => string) | undefined
  readonly unit?: string | undefined
  readonly className?: string | undefined
}

const LARGE_STEP_MULTIPLIER = 10

function clamp(value: number, min: number, max: number): number {
  return Math.min(Math.max(value, min), max)
}

function quantize(value: number, min: number, step: number): number {
  return min + Math.round((value - min) / step) * step
}

/**
 * Custom range slider (DESIGN.md §7: native `<input type="range">` is
 * banned). Drag anywhere on the track to jump; arrow keys / Page Up-Down /
 * Home / End move the thumb; the value always renders tabular in `.num`.
 */
export function Slider({
  value,
  min,
  max,
  step = 1,
  onChange,
  "aria-label": ariaLabel,
  disabled = false,
  formatValue,
  unit,
  className,
}: SliderProps) {
  const trackRef = useRef<HTMLDivElement>(null)
  const percent = ((clamp(value, min, max) - min) / (max - min)) * 100

  function commitFromClientX(clientX: number) {
    const rect = trackRef.current?.getBoundingClientRect()
    if (rect === undefined || rect.width === 0) {
      return
    }
    const ratio = clamp((clientX - rect.left) / rect.width, 0, 1)
    const raw = min + ratio * (max - min)
    onChange(clamp(quantize(raw, min, step), min, max))
  }

  function handlePointerDown(event: ReactPointerEvent<HTMLDivElement>) {
    if (disabled) {
      return
    }
    event.currentTarget.setPointerCapture(event.pointerId)
    commitFromClientX(event.clientX)
  }

  function handlePointerMove(event: ReactPointerEvent<HTMLDivElement>) {
    if (disabled || event.buttons !== 1) {
      return
    }
    commitFromClientX(event.clientX)
  }

  function handleKeyDown(event: ReactKeyboardEvent<HTMLDivElement>) {
    if (disabled) {
      return
    }
    const bigStep = step * LARGE_STEP_MULTIPLIER
    const next = {
      ArrowRight: value + step,
      ArrowUp: value + step,
      ArrowLeft: value - step,
      ArrowDown: value - step,
      PageUp: value + bigStep,
      PageDown: value - bigStep,
      Home: min,
      End: max,
    }[event.key]
    if (next === undefined) {
      return
    }
    event.preventDefault()
    onChange(clamp(quantize(next, min, step), min, max))
  }

  const displayValue = formatValue ? formatValue(value) : String(value)

  return (
    <div className={cx(styles.root, className)}>
      <div
        ref={trackRef}
        className={styles.track}
        onPointerDown={handlePointerDown}
        onPointerMove={handlePointerMove}
      >
        <div className={styles.bar} />
        <div className={styles.fill} style={{ width: `${percent}%` }} />
        <div
          role="slider"
          tabIndex={disabled ? -1 : 0}
          aria-label={ariaLabel}
          aria-valuemin={min}
          aria-valuemax={max}
          aria-valuenow={value}
          aria-disabled={disabled ? "true" : undefined}
          className={styles.thumb}
          style={{ left: `${percent}%` }}
          onKeyDown={handleKeyDown}
        />
      </div>
      <span className={cx("num", styles.value)}>
        {displayValue}
        {unit === undefined ? null : <span className={styles.unit}>{unit}</span>}
      </span>
    </div>
  )
}
