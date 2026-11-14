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
}: {
  readonly filters: ReadonlyArray<HoverPickerFilterBarItem>
  readonly activeFilterIds: ReadonlySet<string>
  readonly onToggle: (id: string) => void
}) {
  if (filters.length === 0) {
    return null
  }
  return (
    <fieldset className={styles.filterBar}>
      <legend className="sr-only">Filters</legend>
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
