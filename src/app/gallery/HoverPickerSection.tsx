import { useState } from "react"
import { Badge } from "@/components/Badge"
import { HoverPicker } from "@/components/HoverPicker"
import { GALLERY_PICKER_ENTRIES, GALLERY_PICKER_FILTERS, type GalleryPickerEntry } from "./fixtures"
import styles from "./GalleryLayout.module.css"
import { GallerySwatch } from "./GallerySwatch"
import itemStyles from "./HoverPickerSection.module.css"

function monogramFor(entry: GalleryPickerEntry): string {
  const digits = /\d+$/.exec(entry.name)?.[0] ?? "00"
  return digits.padStart(2, "0").slice(-2)
}

export function HoverPickerSection() {
  const [selected, setSelected] = useState<GalleryPickerEntry | null>(null)
  // WCAG 2.5.3 Label in Name: the accessible name must contain the visible
  // trigger text verbatim, so it has to incorporate whatever the badge
  // currently shows instead of staying a fixed, unrelated string.
  const triggerLabel = selected === null ? "Choose champion" : selected.name
  const ariaLabel = selected === null ? "Choose champion" : `Choose champion: ${selected.name}`

  return (
    <section className={styles.section}>
      <h2 className={styles.sectionTitle}>HoverPicker</h2>
      <div className={styles.row}>
        <GallerySwatch label={`Selected: ${selected?.name ?? "none"}`}>
          <HoverPicker
            trigger={<Badge>{triggerLabel}</Badge>}
            items={GALLERY_PICKER_ENTRIES}
            getKey={(entry) => entry.id}
            renderItem={(entry) => (
              <>
                <span className={itemStyles.avatar}>{monogramFor(entry)}</span>
                <span className={itemStyles.itemName}>{entry.name}</span>
              </>
            )}
            searchText={(entry) => entry.name}
            filters={GALLERY_PICKER_FILTERS}
            isDisabled={(entry) => !entry.modeled}
            disabledBadge="Not modeled"
            isSelected={(entry) => entry.id === selected?.id}
            onSelect={setSelected}
            columns={3}
            aria-label={ariaLabel}
          />
        </GallerySwatch>
      </div>
    </section>
  )
}
