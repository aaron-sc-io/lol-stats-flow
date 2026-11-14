import { Button } from "@/components/Button"
import { IconButton } from "@/components/IconButton"
import { NumberField } from "@/components/NumberField"
import type { TargetSpec } from "@/engine"
import { useGraphStore } from "@/graph/store"
import styles from "./GraphNode.module.css"

const TARGET_PRESETS = [
  { label: "Squishy", maxHp: 2000, armor: 40, magicResist: 30 },
  { label: "Bruiser", maxHp: 3200, armor: 90, magicResist: 60 },
  { label: "Tank", maxHp: 4200, armor: 150, magicResist: 100 },
] as const

const STAT_FIELDS: ReadonlyArray<{
  readonly key: "maxHp" | "bonusHp" | "armor" | "magicResist"
  readonly label: string
  readonly min: number
}> = [
  { key: "maxHp", label: "HP", min: 1 },
  { key: "bonusHp", label: "Bonus HP", min: 0 },
  { key: "armor", label: "Armor", min: 0 },
  { key: "magicResist", label: "MR", min: 0 },
]

function TargetRow({
  graphNodeId,
  target,
  selected,
  onToggle,
}: {
  readonly graphNodeId: string
  readonly target: TargetSpec
  readonly selected: boolean
  readonly onToggle: () => void
}) {
  const renameTarget = useGraphStore((s) => s.renameTarget)
  const updateTargetStat = useGraphStore((s) => s.updateTargetStat)
  const applyTargetPreset = useGraphStore((s) => s.applyTargetPreset)
  const removeTarget = useGraphStore((s) => s.removeTarget)

  return (
    <div className={styles.targetBlock}>
      <div className={styles.targetHeader}>
        <label className={styles.targetSelectLabel}>
          <input
            type="checkbox"
            checked={selected}
            onChange={onToggle}
            aria-label={`Include ${target.name} in chart`}
          />
          <span>On</span>
        </label>
        <input
          type="text"
          className={styles.targetName}
          value={target.name}
          onChange={(event) => renameTarget(graphNodeId, target.id, event.target.value)}
          aria-label="Target name"
        />
        <div className={styles.targetPresets}>
          {TARGET_PRESETS.map((preset) => (
            <Button
              key={preset.label}
              variant="ghost"
              onClick={() => applyTargetPreset(graphNodeId, target.id, preset)}
            >
              {preset.label}
            </Button>
          ))}
        </div>
        <IconButton
          icon="trash"
          aria-label={`Remove target ${target.name}`}
          size={24}
          onClick={() => removeTarget(graphNodeId, target.id)}
        />
      </div>
      <div className={styles.targetFields}>
        {STAT_FIELDS.map((field) => (
          <div key={field.key} className={styles.targetField}>
            <span className={styles.targetFieldLabel}>{field.label}</span>
            <NumberField
              value={target[field.key]}
              onChange={(value) => updateTargetStat(graphNodeId, target.id, field.key, value)}
              min={field.min}
              aria-label={`${target.name} ${field.label}`}
              className={styles.targetFieldInput}
            />
          </div>
        ))}
      </div>
    </div>
  )
}

export function TargetsPanel({
  graphNodeId,
  targets,
  activeTargetIds,
  onToggleTarget,
  onSelectAll,
}: {
  readonly graphNodeId: string
  readonly targets: readonly TargetSpec[]
  readonly activeTargetIds: readonly string[]
  readonly onToggleTarget: (targetId: string) => void
  readonly onSelectAll: () => void
}) {
  const addTarget = useGraphStore((s) => s.addTarget)
  const selectedTargetIds = new Set(activeTargetIds)
  const allSelected = targets.length > 0 && activeTargetIds.length >= targets.length

  return (
    <div className={styles.targetsPanel}>
      <div className={styles.targetsToolbar}>
        <Button variant="ghost" className={styles.addTarget} onClick={() => addTarget(graphNodeId)}>
          + Add target
        </Button>
        <Button variant="ghost" onClick={onSelectAll} disabled={allSelected}>
          All
        </Button>
      </div>
      {targets.map((target) => (
        <TargetRow
          key={target.id}
          graphNodeId={graphNodeId}
          target={target}
          selected={selectedTargetIds.has(target.id)}
          onToggle={() => onToggleTarget(target.id)}
        />
      ))}
    </div>
  )
}
