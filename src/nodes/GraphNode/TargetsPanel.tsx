import { Button } from "@/components/Button"
import { DeleteBadge } from "@/components/DeleteBadge"
import { EditableText } from "@/components/EditableText"
import { IconButton } from "@/components/IconButton"
import { NumberField } from "@/components/NumberField"
import type { TargetSpec } from "@/engine"
import { useGraphStore } from "@/graph/store"
import type { TargetStatField } from "@/graph/store-types"
import { cx } from "@/lib/cx"
import styles from "./GraphNode.module.css"

const TARGET_PRESETS = [
  { label: "Squishy", maxHp: 2000, armor: 40, bonusArmor: 0, magicResist: 30, bonusMagicResist: 0 },
  {
    label: "Bruiser",
    maxHp: 3200,
    armor: 90,
    bonusArmor: 40,
    magicResist: 60,
    bonusMagicResist: 20,
  },
  {
    label: "Tank",
    maxHp: 4200,
    armor: 150,
    bonusArmor: 90,
    magicResist: 100,
    bonusMagicResist: 50,
  },
] as const

const STAT_FIELDS: ReadonlyArray<{
  readonly key: TargetStatField
  readonly label: string
  readonly min: number
}> = [
  { key: "maxHp", label: "Base HP", min: 1 },
  { key: "bonusHp", label: "Bonus HP", min: 0 },
  { key: "armor", label: "Armor", min: 0 },
  { key: "bonusArmor", label: "of it bonus", min: 0 },
  { key: "magicResist", label: "MR", min: 0 },
  { key: "bonusMagicResist", label: "of it bonus", min: 0 },
]

function TargetCard({
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
        <div className={styles.targetHeaderLeft}>
          <label className={styles.targetSelectLabel}>
            <input
              type="checkbox"
              checked={selected}
              onChange={onToggle}
              aria-label={`Include ${target.name} in chart`}
            />
          </label>
          <EditableText
            wrapperClassName={styles.targetName}
            value={target.name}
            onChange={(event) => renameTarget(graphNodeId, target.id, event.target.value)}
            aria-label="Target name"
          />
          <div className={styles.targetPresets}>
            {TARGET_PRESETS.map((preset) => (
              <Button
                key={preset.label}
                variant="ghost"
                className={styles.presetButton}
                onClick={() => applyTargetPreset(graphNodeId, target.id, preset)}
              >
                {preset.label}
              </Button>
            ))}
          </div>
        </div>
      </div>
      <DeleteBadge
        aria-label={`Remove target ${target.name}`}
        className={styles.targetDelete}
        onClick={() => removeTarget(graphNodeId, target.id)}
      />
      <div className={styles.targetFields}>
        {STAT_FIELDS.map((field) => (
          <div key={field.key} className={styles.targetField}>
            <span className={styles.targetFieldLabel}>{field.label}</span>
            <NumberField
              value={target[field.key] ?? 0}
              onChange={(value) => updateTargetStat(graphNodeId, target.id, field.key, value)}
              min={field.min}
              compact
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
        <IconButton
          icon="plus"
          aria-label="Add target"
          size={24}
          className={styles.addTarget}
          onClick={() => addTarget(graphNodeId)}
        />
        <Button variant="ghost" onClick={onSelectAll} disabled={allSelected}>
          All
        </Button>
      </div>
      <div className={cx(styles.targetsList, "nowheel")}>
        {targets.map((target) => (
          <TargetCard
            key={target.id}
            graphNodeId={graphNodeId}
            target={target}
            selected={selectedTargetIds.has(target.id)}
            onToggle={() => onToggleTarget(target.id)}
          />
        ))}
      </div>
    </div>
  )
}
