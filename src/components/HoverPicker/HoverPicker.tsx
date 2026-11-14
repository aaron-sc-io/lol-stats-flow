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
import type { IconName } from "@/components/icons"
import { SearchField } from "@/components/SearchField"
import { cx } from "@/lib/cx"
import { computeFloatingPosition, type Placement } from "@/lib/floating-position"
import { computeNextGridIndex, matchesActiveFilters } from "./HoverPicker.helpers"
import {
  useDismissOnEscapeOrOutside,
  useFocusTrap,
  useHoverPickerOpenState,
} from "./HoverPicker.hooks"
import styles from "./HoverPicker.module.css"
import { HoverPickerFilterBar } from "./HoverPickerFilterBar"
import { HoverPickerGrid } from "./HoverPickerGrid"

export type HoverPickerFilter<T> = {
  readonly id: string
  readonly icon: IconName
  readonly label: string
  readonly predicate: (item: T) => boolean
}

export type HoverPickerItemState = {
  readonly disabled: boolean
  readonly selected: boolean
}

export type HoverPickerProps<T> = {
  readonly trigger: ReactNode
  readonly items: readonly T[]
  readonly getKey: (item: T) => string | number
  readonly renderItem: (item: T, state: HoverPickerItemState) => ReactNode
  readonly searchText: (item: T) => string
  readonly filters?: ReadonlyArray<HoverPickerFilter<T>> | undefined
  readonly isDisabled?: ((item: T) => boolean) | undefined
  readonly disabledBadge?: string | undefined
  readonly isSelected?: ((item: T) => boolean) | undefined
  readonly onSelect: (item: T) => void
  readonly columns?: number | undefined
  readonly placement?: Placement | undefined
  readonly searchPlaceholder?: string | undefined
  readonly "aria-label": string
  readonly className?: string | undefined
}

/**
 * Abstract hover-opening popover picker — the shared machinery behind the
 * champion roster picker and the item shop (Phase 4b). Opens on a 150ms
 * hover intent, stays open while the pointer is over the trigger OR the
 * popover (250ms leave grace), and is fully keyboard/touch operable via
 * click/Enter/Space on the trigger.
 *
 * Split across this file plus `HoverPicker.hooks.ts` (open/dismiss timers
 * and listeners), `HoverPicker.helpers.ts` (pure filter/nav math),
 * `HoverPickerFilterBar.tsx` and `HoverPickerGrid.tsx` (popover body).
 */
export function HoverPicker<T>({
  trigger,
  items,
  getKey,
  renderItem,
  searchText,
  filters = [],
  isDisabled,
  disabledBadge,
  isSelected,
  onSelect,
  columns = 4,
  placement = "bottom",
  searchPlaceholder = "Search…",
  "aria-label": ariaLabel,
  className,
}: HoverPickerProps<T>) {
  const [search, setSearch] = useState("")
  const [activeFilterIds, setActiveFilterIds] = useState<ReadonlySet<string>>(new Set())
  const [activeIndex, setActiveIndex] = useState(0)
  const [position, setPosition] = useState<{ readonly top: number; readonly left: number } | null>(
    null,
  )

  const triggerRef = useRef<HTMLButtonElement>(null)
  const popoverRef = useRef<HTMLDivElement>(null)
  const searchInputRef = useRef<HTMLInputElement>(null)
  const itemRefs = useRef<Array<HTMLButtonElement | null>>([])
  const popoverId = useId()

  const { isOpen, open, close, scheduleOpen, scheduleClose, cancelScheduledClose } =
    useHoverPickerOpenState(
      () => {
        setSearch("")
        setActiveIndex(0)
      },
      () => setPosition(null),
    )

  useDismissOnEscapeOrOutside({ isOpen, triggerRef, popoverRef, searchInputRef, onClose: close })
  useFocusTrap(popoverRef, isOpen)

  const visibleItems = items.filter(
    (item) =>
      searchText(item).toLowerCase().includes(search.toLowerCase()) &&
      matchesActiveFilters(item, filters, activeFilterIds),
  )

  function handleSelect(item: T) {
    if (isDisabled?.(item) !== true) {
      onSelect(item)
      close()
    }
  }

  useLayoutEffect(() => {
    if (!isOpen) {
      return
    }
    searchInputRef.current?.focus()
    const triggerEl = triggerRef.current
    const popoverEl = popoverRef.current
    if (triggerEl === null || popoverEl === null) {
      return
    }
    setPosition(
      computeFloatingPosition({
        trigger: triggerEl.getBoundingClientRect(),
        floating: popoverEl.getBoundingClientRect(),
        placement,
        viewport: { width: window.innerWidth, height: window.innerHeight },
      }),
    )
  }, [isOpen, placement])

  useEffect(() => {
    setActiveIndex((current) => Math.min(current, Math.max(visibleItems.length - 1, 0)))
  }, [visibleItems.length])

  function handleGridKeyDown(event: ReactKeyboardEvent<HTMLDivElement>) {
    const next = computeNextGridIndex(event.key, activeIndex, visibleItems.length, columns)
    if (next !== null) {
      event.preventDefault()
      setActiveIndex(next)
      itemRefs.current[next]?.focus()
    }
  }

  function handleSearchKeyDown(event: ReactKeyboardEvent<HTMLInputElement>) {
    if (event.key === "ArrowDown" && visibleItems.length > 0) {
      event.preventDefault()
      setActiveIndex(0)
      itemRefs.current[0]?.focus()
    }
  }

  function toggleFilter(id: string) {
    setActiveFilterIds((current) => {
      const next = new Set(current)
      next.has(id) ? next.delete(id) : next.add(id)
      return next
    })
  }

  return (
    <>
      <button
        ref={triggerRef}
        type="button"
        aria-label={ariaLabel}
        aria-haspopup="dialog"
        aria-expanded={isOpen}
        className={cx(styles.trigger, className)}
        onPointerEnter={scheduleOpen}
        onPointerLeave={scheduleClose}
        onClick={() => (isOpen ? close() : open())}
      >
        {trigger}
      </button>
      {isOpen
        ? createPortal(
            <div
              ref={popoverRef}
              id={popoverId}
              role="dialog"
              aria-label={ariaLabel}
              className={cx(
                "nodrag",
                "nowheel",
                "nopan",
                styles.popover,
                position === null && styles.measuring,
              )}
              style={position === null ? undefined : { top: position.top, left: position.left }}
              onPointerEnter={cancelScheduledClose}
              onPointerLeave={scheduleClose}
            >
              <SearchField
                ref={searchInputRef}
                value={search}
                onChange={setSearch}
                onKeyDown={handleSearchKeyDown}
                placeholder={searchPlaceholder}
                aria-label="Search"
              />
              <HoverPickerFilterBar
                filters={filters}
                activeFilterIds={activeFilterIds}
                onToggle={toggleFilter}
              />
              <HoverPickerGrid
                items={visibleItems}
                getKey={getKey}
                renderItem={renderItem}
                isDisabled={isDisabled}
                isSelected={isSelected}
                disabledBadge={disabledBadge}
                columns={columns}
                activeIndex={activeIndex}
                itemRefs={itemRefs}
                onSelect={handleSelect}
                onKeyDown={handleGridKeyDown}
              />
            </div>,
            document.body,
          )
        : null}
    </>
  )
}
