import type { HoverPickerFilter } from "@/components/HoverPicker"
import { HoverPicker } from "@/components/HoverPicker"
import type { ChampionData, Snapshot } from "@/data/schema"
import styles from "./ChampionNode.module.css"

/** Lane-style role filters (plan D7) mapped onto the snapshot's actual Riot
 * tag vocabulary (Fighter/Tank/Assassin/Mage/Marksman/Support — there is no
 * literal "lane" field in champion data), using the 5 existing `role-*`
 * icons. Approximate by design — Phase 4b owns RosterPicker visual/taxonomy
 * polish; this is the functional version. */
const ROLE_FILTERS: ReadonlyArray<HoverPickerFilter<ChampionData>> = [
  {
    id: "role-top",
    icon: "role-top",
    label: "Fighter / Tank",
    predicate: (c) => c.roles.includes("Fighter") || c.roles.includes("Tank"),
  },
  {
    id: "role-jungle",
    icon: "role-jungle",
    label: "Assassin",
    predicate: (c) => c.roles.includes("Assassin"),
  },
  { id: "role-mid", icon: "role-mid", label: "Mage", predicate: (c) => c.roles.includes("Mage") },
  {
    id: "role-bottom",
    icon: "role-bottom",
    label: "Marksman / ADC",
    predicate: (c) => c.roles.includes("Marksman"),
  },
  {
    id: "role-support",
    icon: "role-support",
    label: "Support",
    predicate: (c) => c.roles.includes("Support"),
  },
]

export function RosterPicker({
  snapshot,
  championId,
  onSelect,
}: {
  readonly snapshot: Snapshot
  readonly championId: string
  readonly onSelect: (champion: ChampionData) => void
}) {
  const champion = snapshot.champions.find((c) => c.id === championId)

  return (
    <HoverPicker
      trigger={
        champion === undefined ? (
          <span className={styles.portraitFallback}>?</span>
        ) : (
          <img src={champion.iconUrl} alt={champion.name} className={styles.portraitImg} />
        )
      }
      items={snapshot.champions}
      getKey={(c) => c.id}
      renderItem={(c) => (
        <>
          <img src={c.iconUrl} alt="" className={styles.pickerItemIcon} />
          <span className={styles.pickerItemName}>{c.name}</span>
        </>
      )}
      searchText={(c) => c.name}
      filters={ROLE_FILTERS}
      isDisabled={(c) => !c.modeled}
      disabledBadge="Not modeled"
      isSelected={(c) => c.id === championId}
      onSelect={onSelect}
      columns={4}
      aria-label="Choose champion"
    />
  )
}
