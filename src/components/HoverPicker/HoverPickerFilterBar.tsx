import { IconButton } from "@/components/IconButton"
import type { IconName } from "@/components/icons"
import styles from "./HoverPicker.module.css"

export type HoverPickerFilterBarItem = {
  readonly id: string
  readonly icon: IconName
  readonly label: string
}

export function HoverPickerFilterBar({
  filters,
  activeFilterIds,
  onToggle,
  onClear,
}: {
  readonly filters: ReadonlyArray<HoverPickerFilterBarItem>
  readonly activeFilterIds: ReadonlySet<string>
  readonly onToggle: (id: string) => void
  readonly onClear: () => void
}) {
  if (filters.length === 0) {
    return null
  }
  return (
    <fieldset className={styles.filterBar}>
      <legend className="sr-only">Filters</legend>
      <IconButton
        icon="close"
        aria-label="Clear filters"
        size={24}
        className={styles.clearFiltersButton}
        disabled={activeFilterIds.size === 0}
        onClick={onClear}
      />
      {filters.map((filter) => (
        <IconButton
          key={filter.id}
          icon={filter.icon}
          aria-label={filter.label}
          size={24}
          variant={activeFilterIds.has(filter.id) ? "subtle" : "ghost"}
          onClick={() => onToggle(filter.id)}
        />
      ))}
    </fieldset>
  )
}
