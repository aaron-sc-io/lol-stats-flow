import { Badge } from "@/components/Badge"
import type { HoverPickerFilter } from "@/components/HoverPicker"
import { HoverPicker } from "@/components/HoverPicker"
import type { IconName } from "@/components/icons"
import { Tooltip } from "@/components/Tooltip"
import type { ItemData, Snapshot } from "@/data/schema"
import { canAddItemToSet } from "@/graph/item-rules"
import { cx } from "@/lib/cx"
import styles from "./ChampionNode.module.css"

const SUMMONERS_RIFT_MAP_ID = "11"

type StatFilterSource = {
  readonly id: string
  readonly icon: IconName
  readonly label: string
  readonly tags: readonly string[]
}

/** Stat-category filter source data (DESIGN.md/plan D7's 12 labeled icons),
 * mapped onto the snapshot's real `statCategories` tag vocabulary. Kept as
 * its own explicitly-typed array (rather than inlined into the `.map()`
 * below) so `icon` stays narrowed to `IconName` instead of widening to
 * `string`. */
const STAT_FILTER_SOURCES: readonly StatFilterSource[] = [
  { id: "stat-ad", icon: "stat-ad", label: "Attack Damage", tags: ["Damage"] },
  {
    id: "stat-attack-speed",
    icon: "stat-attack-speed",
    label: "Attack Speed",
    tags: ["AttackSpeed"],
  },
  { id: "stat-crit", icon: "stat-crit", label: "Critical Strike", tags: ["CriticalStrike"] },
  {
    id: "stat-lethality",
    icon: "stat-lethality",
    label: "Lethality / Armor Pen",
    tags: ["ArmorPenetration"],
  },
  { id: "stat-ap", icon: "stat-ap", label: "Ability Power", tags: ["SpellDamage"] },
  {
    id: "stat-magic-pen",
    icon: "stat-magic-pen",
    label: "Magic Penetration",
    tags: ["MagicPenetration"],
  },
  { id: "stat-health", icon: "stat-health", label: "Health", tags: ["Health"] },
  { id: "stat-armor", icon: "stat-armor", label: "Armor", tags: ["Armor"] },
  {
    id: "stat-magic-resist",
    icon: "stat-magic-resist",
    label: "Magic Resist",
    tags: ["SpellBlock", "MagicResist"],
  },
  {
    id: "stat-ability-haste",
    icon: "stat-ability-haste",
    label: "Ability Haste",
    tags: ["AbilityHaste"],
  },
  {
    id: "stat-move-speed",
    icon: "stat-move-speed",
    label: "Move Speed",
    tags: ["NonbootsMovement", "Boots"],
  },
  {
    id: "stat-lifesteal",
    icon: "stat-lifesteal",
    label: "Lifesteal / Omnivamp",
    tags: ["LifeSteal", "SpellVamp"],
  },
]

const STAT_FILTERS: ReadonlyArray<HoverPickerFilter<ItemData>> = STAT_FILTER_SOURCES.map(
  (filter) => ({
    id: filter.id,
    icon: filter.icon,
    label: filter.label,
    predicate: (item: ItemData) => filter.tags.some((tag) => item.statCategories.includes(tag)),
  }),
)

export type ItemSlotControlProps = {
  readonly snapshot: Snapshot
  readonly equipped: ItemData | null
  readonly currentSetItems: readonly ItemData[]
  readonly onEquip: (item: ItemData) => void
  readonly onRemove: () => void
  readonly slotLabel: string
}

/** One item-shop slot (plan D7/deliverable 3): empty slots open the
 * HoverPicker-based shop; a filled slot renders the equipped icon and
 * clicking it removes the item directly (per deliverable: "clicking a
 * filled slot offers remove") instead of reopening the shop. */
export function ItemSlotControl({
  snapshot,
  equipped,
  currentSetItems,
  onEquip,
  onRemove,
  slotLabel,
}: ItemSlotControlProps) {
  if (equipped !== null) {
    return (
      <Tooltip label={`Remove ${equipped.name}`}>
        <button
          type="button"
          aria-label={`Remove ${equipped.name}`}
          className={styles.filledSlot}
          onClick={onRemove}
        >
          <img src={equipped.iconUrl} alt="" className={styles.slotIcon} />
        </button>
      </Tooltip>
    )
  }

  const shopItems = snapshot.items.filter(
    (item) => item.purchasable && item.maps[SUMMONERS_RIFT_MAP_ID] === true,
  )

  return (
    <HoverPicker
      trigger={<span className={styles.emptySlot}>+</span>}
      items={shopItems}
      getKey={(item) => item.id}
      renderItem={(item) => (
        <>
          <img src={item.iconUrl} alt="" className={styles.pickerItemIcon} />
          <span className={styles.pickerItemName}>{item.name}</span>
          <span className={cx("num", styles.pickerItemCost)}>
            {item.goldTotal.toLocaleString()}g
          </span>
          {item.modeled ? null : <Badge className={styles.unmodeledBadge}>Unmodeled</Badge>}
        </>
      )}
      searchText={(item) => item.name}
      filters={STAT_FILTERS}
      isDisabled={(item) => !canAddItemToSet(currentSetItems, item).canAdd}
      disabledBadge="Unavailable"
      onSelect={onEquip}
      columns={3}
      aria-label={`${slotLabel}: choose item`}
      searchPlaceholder="Search items…"
    />
  )
}
