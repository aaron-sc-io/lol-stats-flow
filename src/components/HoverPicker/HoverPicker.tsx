import {
  type KeyboardEvent as ReactKeyboardEvent,
  type ReactNode,
  useCallback,
  useEffect,
  useId,
  useLayoutEffect,
  useMemo,
  useRef,
  useState,
} from "react"
import { createPortal } from "react-dom"
import type { IconName } from "@/components/icons"
import { SearchField } from "@/components/SearchField"
import { cx } from "@/lib/cx"
import { computeFloatingPosition, type Placement } from "@/lib/floating-position"
import {
  computeNextGridIndex,
  filterIndexedItems,
  indexItemsForSearch,
} from "./HoverPicker.helpers"
import {
  useDismissOnEscapeOrOutside,
  useFocusTrap,
  useHoverPickerImagePreload,
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
  /** Optional icon URL extractor so item images can be preloaded and decoded
   * during idle time and on trigger pointerEnter/focus before the popover mounts. */
  readonly imageUrl?: ((item: T) => string) | undefined
  readonly filters?: ReadonlyArray<HoverPickerFilter<T>> | undefined
  readonly isDisabled?: ((item: T) => boolean) | undefined
  readonly disabledBadge?: string | undefined
  readonly isSelected?: ((item: T) => boolean) | undefined
  readonly onSelect: (item: T) => void
  readonly columns?: number | undefined
  /** When set, each cell's accessible name + hover/focus tooltip — for
   * icon-only `renderItem`s that show no visible text. */
  readonly itemLabel?: ((item: T) => string) | undefined
  /** Dense icon-grid layout: filters become a vertical rail on the grid's
   * left, and the grid only ever scrolls vertically. */
  readonly compact?: boolean | undefined
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
  imageUrl,
  filters = [],
  isDisabled,
  disabledBadge,
  isSelected,
  onSelect,
  columns = 4,
  itemLabel,
  compact = false,
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

  const triggerPreload = useHoverPickerImagePreload(items, imageUrl)

  const handleTriggerPointerEnter = useCallback(() => {
    triggerPreload()
    scheduleOpen()
  }, [triggerPreload, scheduleOpen])

  const indexedItems = useMemo(() => indexItemsForSearch(items, searchText), [items, searchText])

  const visibleItems = useMemo(
    () => filterIndexedItems(indexedItems, search, filters, activeFilterIds),
    [indexedItems, search, filters, activeFilterIds],
  )

  const handleSelect = useCallback(
    (item: T) => {
      if (isDisabled?.(item) !== true) {
        onSelect(item)
        close()
      }
    },
    [isDisabled, onSelect, close],
  )

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

  const handleGridKeyDown = useCallback(
    (event: ReactKeyboardEvent<HTMLDivElement>) => {
      const next = computeNextGridIndex(event.key, activeIndex, visibleItems.length, columns)
      if (next !== null) {
        event.preventDefault()
        setActiveIndex(next)
        itemRefs.current[next]?.focus()
      }
    },
    [activeIndex, visibleItems.length, columns],
  )

  const handleSearchKeyDown = useCallback(
    (event: ReactKeyboardEvent<HTMLInputElement>) => {
      if (event.key === "ArrowDown" && visibleItems.length > 0) {
        event.preventDefault()
        setActiveIndex(0)
        itemRefs.current[0]?.focus()
      }
    },
    [visibleItems.length],
  )

  const toggleFilter = useCallback((id: string) => {
    setActiveFilterIds((current) => {
      const next = new Set(current)
      next.has(id) ? next.delete(id) : next.add(id)
      return next
    })
  }, [])

  const clearFilters = useCallback(() => {
    setActiveFilterIds(new Set())
  }, [])

  return (
    <>
      <button
        ref={triggerRef}
        type="button"
        aria-label={ariaLabel}
        aria-haspopup="dialog"
        aria-expanded={isOpen}
        className={cx(styles.trigger, className)}
        onPointerEnter={handleTriggerPointerEnter}
        onFocus={triggerPreload}
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
                compact && styles.compact,
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
              <div className={styles.body}>
                <HoverPickerFilterBar
                  filters={filters}
                  activeFilterIds={activeFilterIds}
                  onToggle={toggleFilter}
                  onClear={clearFilters}
                />
                <HoverPickerGrid
                  items={visibleItems}
                  getKey={getKey}
                  renderItem={renderItem}
                  itemLabel={itemLabel}
                  isDisabled={isDisabled}
                  isSelected={isSelected}
                  disabledBadge={disabledBadge}
                  columns={columns}
                  activeIndex={activeIndex}
                  itemRefs={itemRefs}
                  onSelect={handleSelect}
                  onKeyDown={handleGridKeyDown}
                />
              </div>
            </div>,
            document.body,
          )
        : null}
    </>
  )
}
