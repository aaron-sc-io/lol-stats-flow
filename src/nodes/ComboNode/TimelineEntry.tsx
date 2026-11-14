import { useSortable } from "@dnd-kit/sortable"
import type { CSSProperties } from "react"
import { DamageTypeChip } from "@/components/DamageTypeChip"
import { IconButton } from "@/components/IconButton"
import { Icon } from "@/components/icons"
import { NumberField } from "@/components/NumberField"
import type { ComboStep } from "@/engine"
import type { ChartPoint } from "@/graph/chart-points"
import { useGraphStore } from "@/graph/store"
import { cx } from "@/lib/cx"
import styles from "./ComboNode.module.css"

const MAX_DELAY_MS = 5000
const DELAY_STEP_MS = 50

function monogramFor(name: string): string {
  return name.slice(0, 2).toUpperCase()
}

function dominantDamageType(point: ChartPoint): "physical" | "magic" | "true" {
  if (point.physical >= point.magic && point.physical >= point.true) {
    return "physical"
  }
  return point.magic >= point.true ? "magic" : "true"
}

export function TimelineEntry({
  comboNodeId,
  step,
  index,
  actionLabel,
  championName,
  orphaned,
  chartPoint,
  onDelete,
}: {
  readonly comboNodeId: string
  readonly step: ComboStep
  readonly index: number
  readonly actionLabel: string
  readonly championName: string
  readonly orphaned: boolean
  readonly chartPoint: ChartPoint | undefined
  readonly onDelete: () => void
}) {
  const { attributes, listeners, setNodeRef, transform, transition, isDragging } = useSortable({
    id: step.id,
  })
  const setComboStepDelay = useGraphStore((s) => s.setComboStepDelay)
  const hoveredStepId = useGraphStore((s) => s.hoveredStepId)
  const setHoveredStep = useGraphStore((s) => s.setHoveredStep)

  const style: CSSProperties = {
    transform:
      transform === null ? undefined : `translate3d(${transform.x}px, ${transform.y}px, 0)`,
    transition: transition ?? undefined,
    opacity: isDragging ? 0.5 : undefined,
  }

  return (
    <li
      ref={setNodeRef}
      style={style}
      className={cx(styles.timelineEntry, orphaned && styles.orphaned)}
      data-highlighted={hoveredStepId === step.id ? "true" : undefined}
      title={orphaned ? "Source disconnected" : undefined}
      onMouseEnter={() => setHoveredStep(step.id)}
      onMouseLeave={() => setHoveredStep(null)}
    >
      <button
        type="button"
        className={styles.dragHandle}
        aria-label={`Reorder step ${index + 1}: ${actionLabel}`}
        {...attributes}
        {...listeners}
      >
        <Icon name="grip" size={16} />
      </button>
      <span className={styles.sourceMonogram}>{monogramFor(championName)}</span>
      <span className={styles.entryLabel}>{actionLabel}</span>
      <NumberField
        value={step.delayMs ?? 0}
        onChange={(delayMs) => setComboStepDelay(comboNodeId, step.id, delayMs)}
        min={0}
        max={MAX_DELAY_MS}
        step={DELAY_STEP_MS}
        unit="ms"
        aria-label={`Delay before step ${index + 1}`}
        className={styles.delayField}
      />
      {chartPoint === undefined ? null : (
        <DamageTypeChip type={dominantDamageType(chartPoint)}>
          {Math.round(chartPoint.total).toLocaleString()}
        </DamageTypeChip>
      )}
      <IconButton
        icon="close"
        aria-label={`Remove step ${index + 1}: ${actionLabel}`}
        size={24}
        onClick={onDelete}
      />
    </li>
  )
}
