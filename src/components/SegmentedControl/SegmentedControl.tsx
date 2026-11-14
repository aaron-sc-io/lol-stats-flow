import { type CSSProperties, type KeyboardEvent, useRef } from "react"
import { cx } from "@/lib/cx"
import styles from "./SegmentedControl.module.css"

export type SegmentedControlOption<T extends string> = {
  readonly value: T
  readonly label: string
}

export type SegmentedControlProps<T extends string> = {
  readonly options: ReadonlyArray<SegmentedControlOption<T>>
  readonly value: T
  readonly onChange: (value: T) => void
  readonly "aria-label": string
  readonly className?: string | undefined
}

/**
 * Exclusive chart-type / step-tick-mode switch. A single `role="radiogroup"`
 * of `role="radio"` segments with roving tabindex and a sliding background
 * indicator — equal-width segments only (indicator position is pure CSS,
 * no measurement).
 */
export function SegmentedControl<T extends string>({
  options,
  value,
  onChange,
  "aria-label": ariaLabel,
  className,
}: SegmentedControlProps<T>) {
  const buttonRefs = useRef<Array<HTMLButtonElement | null>>([])
  const selectedIndex = Math.max(
    0,
    options.findIndex((option) => option.value === value),
  )
  const lastIndex = options.length - 1

  function selectIndex(index: number) {
    const option = options[index]
    if (option === undefined) {
      return
    }
    onChange(option.value)
    buttonRefs.current[index]?.focus()
  }

  function handleKeyDown(event: KeyboardEvent<HTMLButtonElement>, index: number) {
    if (event.key === "ArrowRight" || event.key === "ArrowDown") {
      event.preventDefault()
      selectIndex(index === lastIndex ? 0 : index + 1)
    } else if (event.key === "ArrowLeft" || event.key === "ArrowUp") {
      event.preventDefault()
      selectIndex(index === 0 ? lastIndex : index - 1)
    } else if (event.key === "Home") {
      event.preventDefault()
      selectIndex(0)
    } else if (event.key === "End") {
      event.preventDefault()
      selectIndex(lastIndex)
    }
  }

  const rootStyle = { "--count": options.length, "--index": selectedIndex } as CSSProperties

  return (
    <div
      role="radiogroup"
      aria-label={ariaLabel}
      className={cx(styles.root, className)}
      style={rootStyle}
    >
      <div className={styles.indicator} aria-hidden="true" />
      {options.map((option, index) => (
        // biome-ignore lint/a11y/useSemanticElements: a native <input type="radio"> can't carry the sliding-indicator visual treatment DESIGN.md requires; role="radio" on a styled <button> is the standard WAI-ARIA pattern for custom radio groups.
        <button
          key={option.value}
          ref={(node) => {
            buttonRefs.current[index] = node
          }}
          type="button"
          role="radio"
          aria-checked={option.value === value}
          tabIndex={option.value === value ? 0 : -1}
          className={styles.segment}
          onClick={() => onChange(option.value)}
          onKeyDown={(event) => handleKeyDown(event, index)}
        >
          {option.label}
        </button>
      ))}
    </div>
  )
}
