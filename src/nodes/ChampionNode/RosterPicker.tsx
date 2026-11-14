import { useMemo } from "react"
import type { HoverPickerFilter } from "@/components/HoverPicker"
import { HoverPicker } from "@/components/HoverPicker"
import type { IconName } from "@/components/icons"
import type { ChampionData, Snapshot } from "@/data/schema"
import { cx } from "@/lib/cx"
import styles from "./ChampionNode.module.css"
import { CHAMPION_LANES, type Lane } from "./champion-lanes"

type FilterSource<K extends string> = {
  readonly key: K
  readonly icon: IconName
  readonly label: string
}

/** Lane filters (Top/Jng/Mid/Bot/Sup), backed by the static
 * `CHAMPION_LANES` table since champion data has no lane field. */
const LANE_FILTER_SOURCES: ReadonlyArray<FilterSource<Lane>> = [
  { key: "top", icon: "role-top", label: "Top lane" },
  { key: "jungle", icon: "role-jungle", label: "Jungle" },
  { key: "mid", icon: "role-mid", label: "Mid lane" },
  { key: "bot", icon: "role-bottom", label: "Bot lane" },
  { key: "support", icon: "role-support", label: "Support lane" },
]

/** Class filters — the client's standard champion-select categories, which
 * are exactly the snapshot's Riot `roles` tag vocabulary. */
const CLASS_FILTER_SOURCES: ReadonlyArray<FilterSource<string>> = [
  { key: "Fighter", icon: "class-fighter", label: "Fighter" },
  { key: "Tank", icon: "class-tank", label: "Tank" },
  { key: "Mage", icon: "class-mage", label: "Mage" },
  { key: "Assassin", icon: "class-assassin", label: "Assassin" },
  { key: "Marksman", icon: "class-marksman", label: "Marksman" },
  { key: "Support", icon: "class-support", label: "Support" },
]

const CHAMPION_FILTERS: ReadonlyArray<HoverPickerFilter<ChampionData>> = [
  ...LANE_FILTER_SOURCES.map((lane) => ({
    id: `lane-${lane.key}`,
    icon: lane.icon,
    label: lane.label,
    predicate: (c: ChampionData) => CHAMPION_LANES[c.id]?.includes(lane.key) ?? false,
  })),
  ...CLASS_FILTER_SOURCES.map((cls) => ({
    id: `class-${cls.key}`,
    icon: cls.icon,
    label: cls.label,
    predicate: (c: ChampionData) => c.roles.includes(cls.key),
  })),
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
  // Available (modeled) champions first; stable sort keeps the snapshot's
  // order within each group. Search/filters apply on top of this order.
  const orderedChampions = useMemo(
    () => [...snapshot.champions].sort((a, b) => Number(b.modeled) - Number(a.modeled)),
    [snapshot.champions],
  )

  return (
    <HoverPicker
      trigger={
        champion === undefined ? (
          <span className={styles.portraitFallback}>?</span>
        ) : (
          <img src={champion.iconUrl} alt={champion.name} className={styles.portraitImg} />
        )
      }
      items={orderedChampions}
      getKey={(c) => c.id}
      renderItem={(c, { disabled }) => (
        <img
          src={c.iconUrl}
          alt=""
          className={cx(styles.pickerItemIcon, disabled && styles.pickerItemUnavailable)}
        />
      )}
      itemLabel={(c) => (c.modeled ? c.name : `${c.name} (unavailable)`)}
      searchText={(c) => c.name}
      filters={CHAMPION_FILTERS}
      isDisabled={(c) => !c.modeled}
      isSelected={(c) => c.id === championId}
      onSelect={onSelect}
      columns={7}
      compact
      aria-label="Choose champion"
      searchPlaceholder="Search champions…"
    />
  )
}
