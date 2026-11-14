import { useSortable } from "@dnd-kit/sortable"
import type { CSSProperties } from "react"
import { DamageTypeChip } from "@/components/DamageTypeChip"
import { IconButton } from "@/components/IconButton"
import { Icon } from "@/components/icons"
import { NumberField } from "@/components/NumberField"
import type { ComboStep } from "@/engine"
import { type ChartPoint, dominantDamageType } from "@/graph/chart-points"
import { useGraphStore } from "@/graph/store"
import { cx } from "@/lib/cx"
import { AbilityIconContent } from "./AbilityPaletteSection"
import styles from "./ComboNode.module.css"

const MAX_DELAY_MS = 5000
const DELAY_STEP_MS = 50

/** This step's damage under one item-set variant of the combo. */
export type StepDamage = {
  readonly variantId: string
  readonly variantName: string
  readonly point: ChartPoint | undefined
}

/** One timeline tile: reorder/remove handles above, the ability icon (same
 * indicator as its palette button), its damage per item-set variant below,
 * then the pre-cast delay. */
export function TimelineEntry({
  comboNodeId,
  step,
  index,
  actionLabel,
  iconUrl,
  keyLabel,
  itemSetIds,
  orphaned,
  damages,
  onDelete,
}: {
  readonly comboNodeId: string
  readonly step: ComboStep
  readonly index: number
  readonly actionLabel: string
  readonly iconUrl: string | undefined
  readonly keyLabel: string
  /** The step's champion's connected item sets — highlighted on hover. */
  readonly itemSetIds: readonly string[]
  readonly orphaned: boolean
  readonly damages: readonly StepDamage[]
  readonly onDelete: () => void
}) {
  const { attributes, listeners, setNodeRef, transform, transition, isDragging } = useSortable({
    id: step.id,
  })
  const setComboStepDelay = useGraphStore((s) => s.setComboStepDelay)
  const hoveredStepId = useGraphStore((s) => s.hoveredStepId)
  const hoveredStepIds = useGraphStore((s) => s.hoveredStepIds)
  const setHoveredStep = useGraphStore((s) => s.setHoveredStep)
  const setHoveredSteps = useGraphStore((s) => s.setHoveredSteps)
  const setHoveredItemSet = useGraphStore((s) => s.setHoveredItemSet)
  const setHoveredItemSets = useGraphStore((s) => s.setHoveredItemSets)
  const highlighted = hoveredStepId === step.id || hoveredStepIds.includes(step.id)
  // A hovered chart segment points at exactly one of this tile's chips: the
  // damage this step dealt under that series' item-set variant.
  const hoveredVariantId = useGraphStore((s) =>
    s.hoveredDamage !== null &&
    s.hoveredDamage.comboId === comboNodeId &&
    s.hoveredDamage.stepId === step.id
      ? s.hoveredDamage.variantId
      : null,
  )

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
      data-step-id={step.id}
      data-highlighted={highlighted ? "true" : undefined}
      title={orphaned ? "Source disconnected" : undefined}
      onMouseEnter={() => {
        setHoveredStep(step.id)
        setHoveredSteps([step.id])
        setHoveredItemSet(itemSetIds[0] ?? null)
        setHoveredItemSets(itemSetIds)
      }}
      onMouseLeave={() => {
        setHoveredStep(null)
        setHoveredSteps([])
        setHoveredItemSet(null)
        setHoveredItemSets([])
      }}
    >
      <div className={styles.entryHandles}>
        <button
          type="button"
          className={styles.dragHandle}
          aria-label={`Reorder step ${index + 1}: ${actionLabel}`}
          {...attributes}
          {...listeners}
        >
          <Icon name="grip" size={16} />
        </button>
        <IconButton
          icon="close"
          aria-label={`Remove step ${index + 1}: ${actionLabel}`}
          size={24}
          onClick={onDelete}
        />
      </div>
      <span className={styles.entryIcon} title={actionLabel}>
        <AbilityIconContent iconUrl={iconUrl} keyLabel={keyLabel} />
      </span>
      <span className={styles.entryDamage}>
        {damages.map(({ variantId, variantName, point }) =>
          point === undefined ? null : (
            <span
              key={variantId}
              className={styles.entryDamageChip}
              data-highlighted={variantId === hoveredVariantId ? "true" : undefined}
              title={variantName === "" ? undefined : variantName}
            >
              <DamageTypeChip type={dominantDamageType(point)}>
                {Math.round(point.total).toLocaleString()}
              </DamageTypeChip>
            </span>
          ),
        )}
      </span>
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
    </li>
  )
}
