import type { CSSProperties, KeyboardEvent, MutableRefObject, ReactNode } from "react"
import { Badge } from "@/components/Badge"
import { cx } from "@/lib/cx"
import styles from "./HoverPicker.module.css"

export type HoverPickerGridProps<T> = {
  readonly items: readonly T[]
  readonly getKey: (item: T) => string | number
  readonly renderItem: (
    item: T,
    state: { readonly disabled: boolean; readonly selected: boolean },
  ) => ReactNode
  readonly isDisabled?: ((item: T) => boolean) | undefined
  readonly isSelected?: ((item: T) => boolean) | undefined
  readonly disabledBadge?: string | undefined
  readonly columns: number
  readonly activeIndex: number
  readonly itemRefs: MutableRefObject<Array<HTMLButtonElement | null>>
  readonly onSelect: (item: T) => void
  readonly onKeyDown: (event: KeyboardEvent<HTMLDivElement>) => void
}

/** The filtered item grid, or the empty-results state — DESIGN.md §7
 * requires both. Disabled items stay in the grid (greyed + badged,
 * `aria-disabled`) instead of being removed, so users can see what exists
 * but isn't modeled yet. */
export function HoverPickerGrid<T>({
  items,
  getKey,
  renderItem,
  isDisabled,
  isSelected,
  disabledBadge,
  columns,
  activeIndex,
  itemRefs,
  onSelect,
  onKeyDown,
}: HoverPickerGridProps<T>) {
  if (items.length === 0) {
    return <div className={styles.empty}>No results</div>
  }

  const gridStyle = { "--columns": columns } as CSSProperties

  return (
    // biome-ignore lint/a11y/noStaticElementInteractions: every real interactive element inside is one of the roving-tabindex <button> cells below; this is event-delegation only.
    <div className={styles.grid} style={gridStyle} onKeyDown={onKeyDown}>
      {items.map((item, index) => {
        const disabled = isDisabled?.(item) ?? false
        const selected = isSelected?.(item) ?? false
        return (
          <button
            key={getKey(item)}
            ref={(node) => {
              itemRefs.current[index] = node
            }}
            type="button"
            className={cx(styles.item, selected && styles.selected)}
            aria-disabled={disabled ? "true" : undefined}
            tabIndex={index === activeIndex ? 0 : -1}
            onClick={() => onSelect(item)}
          >
            {renderItem(item, { disabled, selected })}
            {disabled && disabledBadge !== undefined ? (
              <Badge className={styles.disabledBadge}>{disabledBadge}</Badge>
            ) : null}
          </button>
        )
      })}
    </div>
  )
}
