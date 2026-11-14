import { useState } from "react"
import { Button } from "@/components/Button"
import { Collapsible } from "@/components/Collapsible"
import { IconButton } from "@/components/IconButton"
import { NumberField } from "@/components/NumberField"
import type { ChampionData } from "@/data/schema"
import type { ComboAction, Kit } from "@/engine"
import { type ActionGroup, groupComboActions, type StackActionGroup } from "@/graph/action-grouping"
import type { ConnectedItemSetSource } from "@/graph/selectors"
import { useGraphStore } from "@/graph/store"
import type { AbilitySlotWithRank } from "@/graph/types"
import { cx } from "@/lib/cx"
import styles from "./ComboNode.module.css"

const RANKABLE_SLOTS: readonly AbilitySlotWithRank[] = ["Q", "W", "E", "R"]

function isRankableSlot(slot: ComboAction["slot"]): slot is AbilitySlotWithRank {
  return (RANKABLE_SLOTS as readonly string[]).includes(slot)
}

type RankControl = {
  readonly championNodeId: string
  readonly itemSetId: string
  readonly maxRank: number
}

function abilityIconUrl(champion: ChampionData, action: ComboAction): string | undefined {
  const slot = action.slot
  return slot === "Q" || slot === "W" || slot === "E" || slot === "R"
    ? champion.abilities[slot].iconUrl
    : undefined
}

/** Compact per-ability rank stepper (plan §6/defect fix: replaces the
 * standalone heavy NumberField row that sat above the whole palette,
 * disconnected from the abilities it modified). Attached directly beneath
 * each rankable ability's icon so rank and ability read as one control. */
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

function AbilityIconContent({
  champion,
  action,
}: {
  readonly champion: ChampionData
  readonly action: ComboAction
}) {
  const iconUrl = abilityIconUrl(champion, action)
  return (
    <>
      {iconUrl === undefined ? null : <img src={iconUrl} alt="" className={styles.paletteIcon} />}
      <span className={styles.paletteKey}>{action.keyLabel}</span>
    </>
  )
}

/** Renders the rank stepper for `action`'s slot when it's rankable — kept
 * as its own component so callers can place it as a *sibling* of (never
 * nested inside) the ability's own `<button>`: axe's `nested-interactive`
 * rule correctly flags a button-inside-a-button as broken for assistive
 * tech, so the stepper's own `-`/`+` buttons must live outside the "add
 * this ability to the combo" button, not inside it. */
function RankStepperFor({
  action,
  rankControl,
}: {
  readonly action: ComboAction
  readonly rankControl: RankControl | undefined
}) {
  const setItemSetRankOverride = useGraphStore((s) => s.setItemSetRankOverride)
  const slot = action.slot
  if (rankControl === undefined || !isRankableSlot(slot)) {
    return null
  }
  return (
    <RankStepper
      slot={slot}
      rank={action.rank}
      maxRank={rankControl.maxRank}
      onChange={(rank) =>
        setItemSetRankOverride(rankControl.championNodeId, rankControl.itemSetId, slot, rank)
      }
    />
  )
}

function SingleActionButton({
  champion,
  action,
  rankControl,
  onAdd,
}: {
  readonly champion: ChampionData
  readonly action: ComboAction
  readonly rankControl?: RankControl | undefined
  readonly onAdd: () => void
}) {
  return (
    <div className={styles.paletteCell}>
      <button type="button" className={styles.paletteButton} onClick={onAdd} title={action.label}>
        <AbilityIconContent champion={champion} action={action} />
      </button>
      <RankStepperFor action={action} rankControl={rankControl} />
    </div>
  )
}

/** Collapses a base ability + its stored-stack variants into one stepper +
 * add control (plan D9 "E0-E4 style collapsed into one entry") — the
 * currently-selected stack count is local UI state, not graph data, since
 * only the *chosen* variant becomes a real combo step on "Add". */
function StackActionControl({
  champion,
  group,
  rankControl,
  onAdd,
}: {
  readonly champion: ChampionData
  readonly group: StackActionGroup
  readonly rankControl?: RankControl | undefined
  readonly onAdd: (actionId: string) => void
}) {
  const [stacks, setStacks] = useState(group.variants.length)
  const selected = stacks === 0 ? group.base : (group.variants[stacks - 1] ?? group.base)

  return (
    <div className={styles.stackControl}>
      <div className={styles.paletteCell}>
        <span className={styles.paletteIconWrap}>
          <AbilityIconContent champion={champion} action={group.base} />
        </span>
        <RankStepperFor action={group.base} rankControl={rankControl} />
      </div>
      <NumberField
        value={stacks}
        onChange={setStacks}
        min={0}
        max={group.variants.length}
        aria-label={`${group.base.keyLabel} stacks`}
      />
      <Button variant="secondary" onClick={() => onAdd(selected.id)}>
        Add
      </Button>
    </div>
  )
}

export function AbilityPaletteSection({
  comboNodeId,
  source,
  kit,
  champion,
  isOpen,
  onToggle,
}: {
  readonly comboNodeId: string
  readonly source: ConnectedItemSetSource
  readonly kit: Kit
  readonly champion: ChampionData
  readonly isOpen: boolean
  readonly onToggle: (open: boolean) => void
}) {
  const addComboStep = useGraphStore((s) => s.addComboStep)
  const groups: ActionGroup[] = groupComboActions(kit.actions)
  const rankControlFor = (slot: ComboAction["slot"]): RankControl | undefined =>
    isRankableSlot(slot)
      ? {
          championNodeId: source.championNode.id,
          itemSetId: source.itemSetId,
          maxRank: champion.abilities[slot].maxRank,
        }
      : undefined

  return (
    <Collapsible
      label={`${champion.name} — ${source.itemSet.name}`}
      open={isOpen}
      onOpenChange={onToggle}
    >
      <div className={styles.paletteGrid}>
        {groups.map((group) =>
          group.kind === "single" ? (
            <SingleActionButton
              key={group.action.id}
              champion={champion}
              action={group.action}
              rankControl={rankControlFor(group.action.slot)}
              onAdd={() => addComboStep(comboNodeId, source.itemSetId, group.action.id)}
            />
          ) : (
            <StackActionControl
              key={group.base.id}
              champion={champion}
              group={group}
              rankControl={rankControlFor(group.base.slot)}
              onAdd={(actionId) => addComboStep(comboNodeId, source.itemSetId, actionId)}
            />
          ),
        )}
      </div>
    </Collapsible>
  )
}
