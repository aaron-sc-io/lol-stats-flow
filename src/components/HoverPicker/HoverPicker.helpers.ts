import type { HoverPickerFilter } from "./HoverPicker"

export type IndexedPickerItem<T> = {
  readonly item: T
  readonly searchLower: string
}

/** Precomputes lowercased search strings once per `items` array so typing in
 * the search box doesn't re-run `searchText(item).toLowerCase()` across
 * hundreds of items on every keystroke. */
export function indexItemsForSearch<T>(
  items: readonly T[],
  searchText: (item: T) => string,
): ReadonlyArray<IndexedPickerItem<T>> {
  return items.map((item) => ({
    item,
    searchLower: searchText(item).toLowerCase(),
  }))
}

/** Filters pre-indexed items by a raw query string and active filter set. */
export function filterIndexedItems<T>(
  indexedItems: ReadonlyArray<IndexedPickerItem<T>>,
  query: string,
  filters: ReadonlyArray<HoverPickerFilter<T>>,
  activeFilterIds: ReadonlySet<string>,
): readonly T[] {
  const normalizedQuery = query.toLowerCase()
  const activeFilters =
    activeFilterIds.size === 0 ? [] : filters.filter((filter) => activeFilterIds.has(filter.id))
  if (normalizedQuery.length === 0 && activeFilters.length === 0) {
    return indexedItems.map((entry) => entry.item)
  }
  const result: T[] = []
  for (const entry of indexedItems) {
    if (
      (normalizedQuery.length === 0 || entry.searchLower.includes(normalizedQuery)) &&
      (activeFilters.length === 0 || activeFilters.every((filter) => filter.predicate(entry.item)))
    ) {
      result.push(entry.item)
    }
  }
  return result
}

/** AND-combines every active filter's predicate — an item must satisfy ALL
 * toggled-on filters, not just one, per DESIGN.md's multi-select filter
 * icons (e.g. "Crit" + "Marksman/ADC" narrows to crit-scaling ADCs only). */
export function matchesActiveFilters<T>(
  item: T,
  filters: ReadonlyArray<HoverPickerFilter<T>>,
  activeFilterIds: ReadonlySet<string>,
): boolean {
  if (activeFilterIds.size === 0) {
    return true
  }
  return filters
    .filter((filter) => activeFilterIds.has(filter.id))
    .every((filter) => filter.predicate(item))
}

/** Clamps a 2D grid index move (by `columns`-wide rows) within bounds —
 * no wraparound, matching the ARIA APG grid pattern's default behavior. */
export function moveGridIndex(current: number, delta: number, count: number): number {
  return Math.min(Math.max(current + delta, 0), count - 1)
}

/** Resolves a keyboard event's key to the next grid index, or `null` if the
 * key doesn't navigate the grid. Pure so the arrow/Home/End math is
 * testable without mounting the component. */
export function computeNextGridIndex(
  key: string,
  activeIndex: number,
  count: number,
  columns: number,
): number | null {
  const deltas: Record<string, number> = {
    ArrowRight: 1,
    ArrowLeft: -1,
    ArrowDown: columns,
    ArrowUp: -columns,
  }
  const delta = deltas[key]
  if (delta !== undefined) {
    return moveGridIndex(activeIndex, delta, count)
  }
  if (key === "Home") {
    return 0
  }
  if (key === "End") {
    return count - 1
  }
  return null
}
