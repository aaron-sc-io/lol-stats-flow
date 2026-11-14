import { useState } from "react"
import { Button } from "@/components/Button"
import { Collapsible } from "@/components/Collapsible"
import { NumberField } from "@/components/NumberField"
import type { ChampionData } from "@/data/schema"
import type { ComboAction, Kit } from "@/engine"
import { type ActionGroup, groupComboActions, type StackActionGroup } from "@/graph/action-grouping"
import type { ConnectedItemSetSource } from "@/graph/selectors"
import { useGraphStore } from "@/graph/store"
import type { AbilitySlotWithRank } from "@/graph/types"
import styles from "./ComboNode.module.css"

const RANKABLE_SLOTS: readonly AbilitySlotWithRank[] = ["Q", "W", "E", "R"]

function abilityIconUrl(champion: ChampionData, action: ComboAction): string | undefined {
  const slot = action.slot
  return slot === "Q" || slot === "W" || slot === "E" || slot === "R"
    ? champion.abilities[slot].iconUrl
    : undefined
}

function AbilityIcon({
  champion,
  action,
}: {
  readonly champion: ChampionData
  readonly action: ComboAction
}) {
  const iconUrl = abilityIconUrl(champion, action)
  return (
    <span className={styles.paletteIconWrap}>
      {iconUrl === undefined ? null : <img src={iconUrl} alt="" className={styles.paletteIcon} />}
      <span className={styles.paletteKey}>{action.keyLabel}</span>
    </span>
  )
}

function SingleActionButton({
  champion,
  action,
  onAdd,
}: {
  readonly champion: ChampionData
  readonly action: ComboAction
  readonly onAdd: () => void
}) {
  return (
    <button type="button" className={styles.paletteButton} onClick={onAdd} title={action.label}>
      <AbilityIcon champion={champion} action={action} />
    </button>
  )
}

/** Collapses a base ability + its stored-stack variants into one stepper +
 * add control (plan D9 "E0-E4 style collapsed into one entry") — the
 * currently-selected stack count is local UI state, not graph data, since
 * only the *chosen* variant becomes a real combo step on "Add". */
function StackActionControl({
  champion,
  group,
  onAdd,
}: {
  readonly champion: ChampionData
  readonly group: StackActionGroup
  readonly onAdd: (actionId: string) => void
}) {
  const [stacks, setStacks] = useState(group.variants.length)
  const selected = stacks === 0 ? group.base : (group.variants[stacks - 1] ?? group.base)

  return (
    <div className={styles.stackControl}>
      <AbilityIcon champion={champion} action={group.base} />
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

function RankControls({
  championNodeId,
  source,
  kit,
  champion,
}: {
  readonly championNodeId: string
  readonly source: ConnectedItemSetSource
  readonly kit: Kit
  readonly champion: ChampionData
}) {
  const setItemSetRankOverride = useGraphStore((s) => s.setItemSetRankOverride)
  const presentSlots = RANKABLE_SLOTS.filter((slot) =>
    kit.actions.some((action) => action.slot === slot),
  )
  if (presentSlots.length === 0) {
    return null
  }

  return (
    <div className={styles.rankRow}>
      {presentSlots.map((slot) => {
        const currentRank = kit.actions.find((action) => action.slot === slot)?.rank ?? 1
        const maxRank = champion.abilities[slot].maxRank
        return (
          <div key={slot} className={styles.rankField}>
            <span className={styles.rankLabel}>{slot} rank</span>
            <NumberField
              value={currentRank}
              onChange={(rank) =>
                setItemSetRankOverride(championNodeId, source.itemSetId, slot, rank)
              }
              min={1}
              max={maxRank}
              aria-label={`${slot} rank`}
            />
          </div>
        )
      })}
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

  return (
    <Collapsible
      label={`${champion.name} — ${source.itemSet.name}`}
      open={isOpen}
      onOpenChange={onToggle}
    >
      <RankControls
        championNodeId={source.championNode.id}
        source={source}
        kit={kit}
        champion={champion}
      />
      <div className={styles.paletteGrid}>
        {groups.map((group) =>
          group.kind === "single" ? (
            <SingleActionButton
              key={group.action.id}
              champion={champion}
              action={group.action}
              onAdd={() => addComboStep(comboNodeId, source.itemSetId, group.action.id)}
            />
          ) : (
            <StackActionControl
              key={group.base.id}
              champion={champion}
              group={group}
              onAdd={(actionId) => addComboStep(comboNodeId, source.itemSetId, actionId)}
            />
          ),
        )}
      </div>
    </Collapsible>
  )
}
