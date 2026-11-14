import type { HoverPickerFilter } from "./HoverPicker"

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
