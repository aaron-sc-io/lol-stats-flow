import {
  type KeyboardEvent as ReactKeyboardEvent,
  type ReactNode,
  useEffect,
  useId,
  useLayoutEffect,
  useRef,
  useState,
} from "react"
import { createPortal } from "react-dom"
import { Icon } from "@/components/icons"
import { cx } from "@/lib/cx"
import { computeFloatingPosition } from "@/lib/floating-position"
import styles from "./Listbox.module.css"

const TYPEAHEAD_RESET_MS = 500

export type ListboxProps<T> = {
  readonly items: readonly T[]
  readonly value: T | null
  readonly onChange: (item: T) => void
  readonly getKey: (item: T) => string
  readonly getLabel: (item: T) => string
  readonly renderOption?: ((item: T) => ReactNode) | undefined
  readonly placeholder?: string | undefined
  readonly "aria-label": string
  readonly disabled?: boolean | undefined
  readonly className?: string | undefined
}

function findTypeaheadIndex<T>(
  items: readonly T[],
  getLabel: (item: T) => string,
  buffer: string,
  fromIndex: number,
): number {
  const query = buffer.toLowerCase()
  for (let offset = 1; offset <= items.length; offset += 1) {
    const index = (fromIndex + offset) % items.length
    const item = items[index]
    if (item !== undefined && getLabel(item).toLowerCase().startsWith(query)) {
      return index
    }
  }
  return fromIndex
}

/**
 * Headless-style select: a trigger button plus a popover `role="listbox"`.
 * Replaces native `<select>` per DESIGN.md §7/§9. Arrow keys and typeahead
 * move the active (highlighted) option; Enter/Space/click commit it.
 */
export function Listbox<T>({
  items,
  value,
  onChange,
  getKey,
  getLabel,
  renderOption,
  placeholder = "Select…",
  "aria-label": ariaLabel,
  disabled = false,
  className,
}: ListboxProps<T>) {
  const [isOpen, setIsOpen] = useState(false)
  const [activeIndex, setActiveIndex] = useState(0)
  const [position, setPosition] = useState<{ readonly top: number; readonly left: number } | null>(
    null,
  )
  const triggerRef = useRef<HTMLButtonElement>(null)
  const listRef = useRef<HTMLDivElement>(null)
  const typeaheadBuffer = useRef("")
  const typeaheadTimer = useRef<ReturnType<typeof setTimeout> | undefined>(undefined)
  const listboxId = useId()

  const selectedIndex =
    value === null ? -1 : items.findIndex((item) => getKey(item) === getKey(value))

  function open() {
    if (disabled || items.length === 0) {
      return
    }
    setActiveIndex(Math.max(selectedIndex, 0))
    setIsOpen(true)
  }

  function close() {
    setIsOpen(false)
    setPosition(null)
  }

  function commit(index: number) {
    const item = items[index]
    if (item !== undefined) {
      onChange(item)
    }
    close()
    triggerRef.current?.focus()
  }

  useLayoutEffect(() => {
    if (!isOpen) {
      return
    }
    listRef.current?.focus()
    const trigger = triggerRef.current
    const list = listRef.current
    if (trigger === null || list === null) {
      return
    }
    const triggerRect = trigger.getBoundingClientRect()
    const listRect = list.getBoundingClientRect()
    setPosition(
      computeFloatingPosition({
        trigger: triggerRect,
        floating: { width: listRect.width || triggerRect.width, height: listRect.height },
        placement: "bottom",
        viewport: { width: window.innerWidth, height: window.innerHeight },
      }),
    )
  }, [isOpen])

  useEffect(() => () => window.clearTimeout(typeaheadTimer.current), [])

  function handleListKeyDown(event: ReactKeyboardEvent<HTMLDivElement>) {
    const lastIndex = items.length - 1
    if (event.key === "ArrowDown") {
      event.preventDefault()
      setActiveIndex((current) => Math.min(current + 1, lastIndex))
    } else if (event.key === "ArrowUp") {
      event.preventDefault()
      setActiveIndex((current) => Math.max(current - 1, 0))
    } else if (event.key === "Home") {
      event.preventDefault()
      setActiveIndex(0)
    } else if (event.key === "End") {
      event.preventDefault()
      setActiveIndex(lastIndex)
    } else if (event.key === "Enter" || event.key === " ") {
      event.preventDefault()
      commit(activeIndex)
    } else if (event.key === "Escape") {
      event.preventDefault()
      close()
      triggerRef.current?.focus()
    } else if (event.key.length === 1 && !event.ctrlKey && !event.metaKey) {
      typeaheadBuffer.current += event.key
      window.clearTimeout(typeaheadTimer.current)
      typeaheadTimer.current = setTimeout(() => {
        typeaheadBuffer.current = ""
      }, TYPEAHEAD_RESET_MS)
      setActiveIndex((current) =>
        findTypeaheadIndex(items, getLabel, typeaheadBuffer.current, current),
      )
    }
  }

  const activeOptionId = `${listboxId}-option-${activeIndex}`

  return (
    <>
      <button
        ref={triggerRef}
        type="button"
        disabled={disabled}
        aria-haspopup="listbox"
        aria-expanded={isOpen}
        className={cx(styles.trigger, className)}
        onClick={() => (isOpen ? close() : open())}
      >
        <span className={cx(styles.triggerLabel, value === null && styles.placeholder)}>
          {value === null ? placeholder : getLabel(value)}
        </span>
        <Icon name="chevron-down" size={16} className={styles.chevron} />
      </button>
      {isOpen
        ? createPortal(
            <div
              ref={listRef}
              id={listboxId}
              role="listbox"
              tabIndex={-1}
              aria-label={ariaLabel}
              aria-activedescendant={activeOptionId}
              className={cx(styles.popover, position === null && styles.measuring)}
              style={position === null ? undefined : { top: position.top, left: position.left }}
              onKeyDown={handleListKeyDown}
            >
              {items.map((item, index) => (
                // biome-ignore lint/a11y/useKeyWithClickEvents: aria-activedescendant pattern — the listbox container (not this option) owns keyboard focus and handles all key input.
                <div
                  key={getKey(item)}
                  id={`${listboxId}-option-${index}`}
                  role="option"
                  tabIndex={-1}
                  aria-selected={index === selectedIndex}
                  className={cx(styles.option, index === activeIndex && styles.active)}
                  onMouseEnter={() => setActiveIndex(index)}
                  onClick={() => commit(index)}
                >
                  {renderOption ? renderOption(item) : getLabel(item)}
                </div>
              ))}
            </div>,
            document.body,
          )
        : null}
    </>
  )
}
