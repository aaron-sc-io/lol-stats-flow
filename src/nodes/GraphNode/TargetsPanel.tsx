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

function TargetRow({
  graphNodeId,
  target,
}: {
  readonly graphNodeId: string
  readonly target: TargetSpec
}) {
  const renameTarget = useGraphStore((s) => s.renameTarget)
  const updateTargetStat = useGraphStore((s) => s.updateTargetStat)
  const applyTargetPreset = useGraphStore((s) => s.applyTargetPreset)
  const removeTarget = useGraphStore((s) => s.removeTarget)

  return (
    <div className={styles.targetRow}>
      <input
        type="text"
        className={styles.targetName}
        value={target.name}
        onChange={(event) => renameTarget(graphNodeId, target.id, event.target.value)}
        aria-label="Target name"
      />
      <NumberField
        value={target.maxHp}
        onChange={(value) => updateTargetStat(graphNodeId, target.id, "maxHp", value)}
        min={1}
        unit="HP"
        aria-label={`${target.name} max HP`}
      />
      <NumberField
        value={target.bonusHp}
        onChange={(value) => updateTargetStat(graphNodeId, target.id, "bonusHp", value)}
        min={0}
        unit="bonus HP"
        aria-label={`${target.name} bonus HP`}
      />
      <NumberField
        value={target.armor}
        onChange={(value) => updateTargetStat(graphNodeId, target.id, "armor", value)}
        unit="armor"
        aria-label={`${target.name} armor`}
      />
      <NumberField
        value={target.magicResist}
        onChange={(value) => updateTargetStat(graphNodeId, target.id, "magicResist", value)}
        unit="MR"
        aria-label={`${target.name} magic resist`}
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
  )
}

export function TargetsPanel({
  graphNodeId,
  targets,
}: {
  readonly graphNodeId: string
  readonly targets: readonly TargetSpec[]
}) {
  const addTarget = useGraphStore((s) => s.addTarget)

  return (
    <div className={styles.targetsPanel}>
      {targets.map((target) => (
        <TargetRow key={target.id} graphNodeId={graphNodeId} target={target} />
      ))}
      <Button variant="ghost" onClick={() => addTarget(graphNodeId)}>
        + Add target
      </Button>
    </div>
  )
}
