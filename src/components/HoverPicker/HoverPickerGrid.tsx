import {
  type CSSProperties,
  type KeyboardEvent,
  type MutableRefObject,
  memo,
  type ReactElement,
  type ReactNode,
  useCallback,
} from "react"
import { Badge } from "@/components/Badge"
import { Tooltip } from "@/components/Tooltip"
import { cx } from "@/lib/cx"
import styles from "./HoverPicker.module.css"

export type HoverPickerGridProps<T> = {
  readonly items: readonly T[]
  readonly getKey: (item: T) => string | number
  readonly renderItem: (
    item: T,
    state: { readonly disabled: boolean; readonly selected: boolean },
  ) => ReactNode
  readonly itemLabel?: ((item: T) => string) | undefined
  readonly isDisabled?: ((item: T) => boolean) | undefined
  readonly isSelected?: ((item: T) => boolean) | undefined
  readonly disabledBadge?: string | undefined
  readonly columns: number
  readonly activeIndex: number
  readonly itemRefs: MutableRefObject<Array<HTMLButtonElement | null>>
  readonly onSelect: (item: T) => void
  readonly onKeyDown: (event: KeyboardEvent<HTMLDivElement>) => void
}

type HoverPickerCellProps<T> = {
  readonly item: T
  readonly index: number
  readonly isActive: boolean
  readonly disabled: boolean
  readonly selected: boolean
  readonly label: string | undefined
  readonly disabledBadge: string | undefined
  readonly renderItem: (
    item: T,
    state: { readonly disabled: boolean; readonly selected: boolean },
  ) => ReactNode
  readonly onSelect: (item: T) => void
  readonly setItemRef: (index: number, node: HTMLButtonElement | null) => void
}

function HoverPickerCellInner<T>({
  item,
  index,
  isActive,
  disabled,
  selected,
  label,
  disabledBadge,
  renderItem,
  onSelect,
  setItemRef,
}: HoverPickerCellProps<T>): ReactElement {
  const handleRef = useCallback(
    (node: HTMLButtonElement | null) => {
      setItemRef(index, node)
    },
    [index, setItemRef],
  )
  const handleClick = useCallback(() => {
    onSelect(item)
  }, [item, onSelect])

  const cell = (
    <button
      ref={handleRef}
      type="button"
      aria-label={label}
      className={cx(styles.item, selected && styles.selected)}
      aria-disabled={disabled ? "true" : undefined}
      tabIndex={isActive ? 0 : -1}
      onClick={handleClick}
    >
      {renderItem(item, { disabled, selected })}
      {disabled && disabledBadge !== undefined ? (
        <Badge className={styles.disabledBadge}>{disabledBadge}</Badge>
      ) : null}
    </button>
  )

  return label === undefined ? cell : <Tooltip label={label}>{cell}</Tooltip>
}

const HoverPickerCell = memo(HoverPickerCellInner) as typeof HoverPickerCellInner

/** The filtered item grid, or the empty-results state — DESIGN.md §7
 * requires both. Disabled items stay in the grid (greyed + badged,
 * `aria-disabled`) instead of being removed, so users can see what exists
 * but isn't modeled yet. */
export function HoverPickerGrid<T>({
  items,
  getKey,
  renderItem,
  itemLabel,
  isDisabled,
  isSelected,
  disabledBadge,
  columns,
  activeIndex,
  itemRefs,
  onSelect,
  onKeyDown,
}: HoverPickerGridProps<T>) {
  const setItemRef = useCallback(
    (index: number, node: HTMLButtonElement | null) => {
      itemRefs.current[index] = node
    },
    [itemRefs],
  )

  if (items.length === 0) {
    return <div className={styles.empty}>No results</div>
  }

  const gridStyle = { "--columns": columns } as CSSProperties

  return (
    // biome-ignore lint/a11y/noStaticElementInteractions: every real interactive element inside is one of the roving-tabindex <button> cells below; this is event-delegation only.
    <div className={styles.grid} style={gridStyle} onKeyDown={onKeyDown}>
      {items.map((item, index) => (
        <HoverPickerCell
          key={getKey(item)}
          item={item}
          index={index}
          isActive={index === activeIndex}
          disabled={isDisabled?.(item) ?? false}
          selected={isSelected?.(item) ?? false}
          label={itemLabel?.(item)}
          disabledBadge={disabledBadge}
          renderItem={renderItem}
          onSelect={onSelect}
          setItemRef={setItemRef}
        />
      ))}
    </div>
  )
}
