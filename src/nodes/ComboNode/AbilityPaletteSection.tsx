import { Collapsible } from "@/components/Collapsible"
import { IconButton } from "@/components/IconButton"
import type { ChampionData } from "@/data/schema"
import type { ComboAction, Kit } from "@/engine"
import { type ActionGroup, groupComboActions, type StackActionGroup } from "@/graph/action-grouping"
import type { ConnectedItemSetSource } from "@/graph/selectors"
import { useGraphStore } from "@/graph/store"
import type { AbilitySlotWithRank } from "@/graph/types"
import { cx } from "@/lib/cx"
import styles from "./ComboNode.module.css"

const RANKABLE_SLOTS: readonly AbilitySlotWithRank[] = ["Q", "W", "E", "R"]
const STACK_VARIANT_ID_PATTERN = /-stack(\d+)$/

function isRankableSlot(slot: ComboAction["slot"]): slot is AbilitySlotWithRank {
  return (RANKABLE_SLOTS as readonly string[]).includes(slot)
}

type RankControl = {
  readonly championNodeId: string
  /** Every connected item set of the champion — a rank change applies to
   * all of them so the item-set variants differ only by items. */
  readonly itemSetIds: readonly string[]
  readonly maxRank: number
}

export function abilityIconUrl(champion: ChampionData, action: ComboAction): string | undefined {
  const slot = action.slot
  return slot === "Q" || slot === "W" || slot === "E" || slot === "R"
    ? champion.abilities[slot].iconUrl
    : undefined
}

function AttackPlaceholderIcon() {
  return (
    <svg
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      strokeWidth={1.5}
      strokeLinecap="round"
      strokeLinejoin="round"
      className={styles.palettePlaceholderIcon}
      aria-hidden="true"
      focusable="false"
    >
      <path d="M14.5 4.5L19.5 4.5L19.5 9.5L10.5 18.5L5.5 13.5Z" />
      <path d="M8 16L4.5 19.5" />
      <path d="M6.5 12.5L11.5 17.5" />
    </svg>
  )
}

function RankStepper({
  slot,
  rank,
  maxRank,
  onChange,
}: {
  readonly slot: AbilitySlotWithRank
  readonly rank: number
  readonly maxRank: number
  readonly onChange: (rank: number) => void
}) {
  return (
    <div className={styles.rankStepper}>
      <IconButton
        icon="minus"
        aria-label={`Decrease ${slot} rank`}
        size={24}
        disabled={rank <= 1}
        onClick={() => onChange(rank - 1)}
      />
      <span className={cx("num", styles.rankValue)}>{rank}</span>
      <IconButton
        icon="plus"
        aria-label={`Increase ${slot} rank`}
        size={24}
        disabled={rank >= maxRank}
        onClick={() => onChange(rank + 1)}
      />
    </div>
  )
}

function stackKeyLabel(baseKeyLabel: string, actionId: string, fallbackIndex: number): string {
  if (fallbackIndex === 0) return `${baseKeyLabel}0`
  const stackIndex = Number(STACK_VARIANT_ID_PATTERN.exec(actionId)?.[1] ?? fallbackIndex)
  return `${baseKeyLabel}${stackIndex}`
}

/** The ability icon (or the auto-attack placeholder) with its key-label
 * badge — shared by the palette buttons and the combo timeline. */
export function AbilityIconContent({
  iconUrl,
  keyLabel,
}: {
  readonly iconUrl: string | undefined
  readonly keyLabel: string
}) {
  return (
    <>
      {iconUrl === undefined ? (
        <AttackPlaceholderIcon />
      ) : (
        <img src={iconUrl} alt="" className={styles.paletteIcon} />
      )}
      <span className={styles.paletteKey} aria-hidden="true">
        {keyLabel}
      </span>
    </>
  )
}

function AbilityIconButton({
  champion,
  action,
  keyLabel,
  onAdd,
}: {
  readonly champion: ChampionData
  readonly action: ComboAction
  readonly keyLabel?: string | undefined
  readonly onAdd: () => void
}) {
  // The accessible name comes from visually-hidden text, not `aria-label`:
  // the visible key badge ("AA✳", "E3") isn't part of the full ability
  // name, which axe's label-content-name-mismatch flags on an aria-label.
  return (
    <button type="button" className={styles.paletteButton} onClick={onAdd} title={action.label}>
      <span className="sr-only">{action.label}</span>
      <AbilityIconContent
        iconUrl={abilityIconUrl(champion, action)}
        keyLabel={keyLabel ?? action.keyLabel}
      />
    </button>
  )
}

function RankStepperFor({
  action,
  rankControl,
}: {
  readonly action: ComboAction
  readonly rankControl: RankControl | undefined
}) {
  const setItemSetRankOverride = useGraphStore((s) => s.setItemSetRankOverride)
  const slot = action.slot
  if (rankControl === undefined || !isRankableSlot(slot)) return null
  return (
    <RankStepper
      slot={slot}
      rank={action.rank}
      maxRank={rankControl.maxRank}
      onChange={(rank) => {
        for (const itemSetId of rankControl.itemSetIds) {
          setItemSetRankOverride(rankControl.championNodeId, itemSetId, slot, rank)
        }
      }}
    />
  )
}

/** One palette cell: every button for a single ability slot plus (for Q/W/E/R)
 * one shared rank stepper. Same-slot groups — Yasuo's Q/Q✳, Darius's
 * Q-blade/Q-handle — share one rank override, so they share one cell. */
type PaletteCellModel = {
  readonly lead: ComboAction
  readonly groups: readonly ActionGroup[]
}

function leadAction(group: ActionGroup): ComboAction {
  return group.kind === "single" ? group.action : group.base
}

function buildPaletteCells(groups: readonly ActionGroup[]): PaletteCellModel[] {
  const cells: { lead: ComboAction; groups: ActionGroup[] }[] = []
  const cellBySlot = new Map<AbilitySlotWithRank, { lead: ComboAction; groups: ActionGroup[] }>()
  for (const group of groups) {
    const lead = leadAction(group)
    const slot = lead.slot
    const existing = isRankableSlot(slot) ? cellBySlot.get(slot) : undefined
    if (existing !== undefined) {
      existing.groups.push(group)
      continue
    }
    const cell = { lead, groups: [group] }
    if (isRankableSlot(slot)) cellBySlot.set(slot, cell)
    cells.push(cell)
  }
  return cells
}

function PaletteCell({
  champion,
  cell,
  rankControl,
  onAdd,
}: {
  readonly champion: ChampionData
  readonly cell: PaletteCellModel
  readonly rankControl?: RankControl | undefined
  readonly onAdd: (actionId: string) => void
}) {
  const buttons = cell.groups.flatMap((group): PaletteButton[] =>
    group.kind === "single" ? [{ action: group.action, keyLabel: undefined }] : stackButtons(group),
  )

  return (
    <div className={styles.paletteCell}>
      <div className={styles.stackVariants}>
        {buttons.map(({ action, keyLabel }) => (
          <AbilityIconButton
            key={action.id}
            champion={champion}
            action={action}
            keyLabel={keyLabel}
            onAdd={() => onAdd(action.id)}
          />
        ))}
      </div>
      <RankStepperFor action={cell.lead} rankControl={rankControl} />
    </div>
  )
}

type PaletteButton = { readonly action: ComboAction; readonly keyLabel: string | undefined }

function stackButtons(group: StackActionGroup): PaletteButton[] {
  return [group.base, ...group.variants].map((variant, index) => ({
    action: variant,
    keyLabel: stackKeyLabel(group.base.keyLabel, variant.id, index),
  }))
}

/** actionId → the key label its palette button shows (`E0`..`E4` for stack
 * variants, the action's own `keyLabel` otherwise), so timeline entries can
 * badge the same icon identically. */
export function actionKeyLabels(actions: readonly ComboAction[]): ReadonlyMap<string, string> {
  const labels = new Map<string, string>()
  for (const group of groupComboActions(actions)) {
    if (group.kind === "single") {
      labels.set(group.action.id, group.action.keyLabel)
      continue
    }
    for (const { action, keyLabel } of stackButtons(group)) {
      labels.set(action.id, keyLabel ?? action.keyLabel)
    }
  }
  return labels
}

/** One champion's ability row: every action of its kit on a single line.
 * The same steps are replayed against each of `sources` (the champion's
 * connected item sets), so the palette is per champion, not per item set. */
export function AbilityPaletteSection({
  comboNodeId,
  sources,
  kit,
  champion,
  isOpen,
  onToggle,
}: {
  readonly comboNodeId: string
  readonly sources: readonly ConnectedItemSetSource[]
  readonly kit: Kit
  readonly champion: ChampionData
  readonly isOpen: boolean
  readonly onToggle: (open: boolean) => void
}) {
  const addComboStep = useGraphStore((s) => s.addComboStep)
  const championNodeId = sources[0]?.championNode.id ?? ""
  const cells = buildPaletteCells(groupComboActions(kit.actions))
  const rankControlFor = (slot: ComboAction["slot"]): RankControl | undefined =>
    isRankableSlot(slot)
      ? {
          championNodeId,
          itemSetIds: sources.map((source) => source.itemSetId),
          maxRank: champion.abilities[slot].maxRank,
        }
      : undefined

  return (
    <Collapsible
      label={`${champion.name} — ${sources.map((source) => source.itemSet.name).join(", ")}`}
      open={isOpen}
      onOpenChange={onToggle}
    >
      <div className={cx(styles.paletteGrid, "nowheel")}>
        {cells.map((cell) => (
          <PaletteCell
            key={cell.lead.id}
            champion={champion}
            cell={cell}
            rankControl={rankControlFor(cell.lead.slot)}
            onAdd={(actionId) => addComboStep(comboNodeId, championNodeId, actionId)}
          />
        ))}
      </div>
    </Collapsible>
  )
}
