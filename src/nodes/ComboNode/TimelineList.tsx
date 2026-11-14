import {
  closestCenter,
  DndContext,
  type DragEndEvent,
  KeyboardSensor,
  PointerSensor,
  useSensor,
  useSensors,
} from "@dnd-kit/core"
import {
  horizontalListSortingStrategy,
  SortableContext,
  sortableKeyboardCoordinates,
} from "@dnd-kit/sortable"
import { useToast } from "@/components/Toast"
import { useSnapshotContext } from "@/data/snapshot-context"
import type { ComboStep, TargetSpec } from "@/engine"
import { buildChartPoints, type ChartPoint } from "@/graph/chart-points"
import type { ComboVariant } from "@/graph/combo-variants"
import type { ConnectedItemSetSource } from "@/graph/selectors"
import { isStepOrphaned, resolveStepChampionNodeId } from "@/graph/selectors"
import { getOrSimulate } from "@/graph/sim-cache"
import { useGraphStore } from "@/graph/store"
import { cx } from "@/lib/cx"
import { abilityIconUrl, actionKeyLabels } from "./AbilityPaletteSection"
import styles from "./ComboNode.module.css"
import { type StepDamage, TimelineEntry } from "./TimelineEntry"

type VariantOutcome = {
  readonly variant: ComboVariant
  readonly total: number
  readonly pointByStepId: ReadonlyMap<string, ChartPoint | undefined>
}

function simulateVariant(variant: ComboVariant, target: TargetSpec | undefined): VariantOutcome {
  if (target === undefined) {
    return { variant, total: 0, pointByStepId: new Map() }
  }
  const result = getOrSimulate(variant.steps, variant.kits, target)
  const points = buildChartPoints(result, variant.steps, target, "step")
  return {
    variant,
    total: result.instances.reduce((sum, instance) => sum + instance.mitigated, 0),
    pointByStepId: new Map(variant.steps.map((step, index) => [step.id, points[index]] as const)),
  }
}

/** The combo order, laid out horizontally: one tile per step showing the
 * same icon as its palette button, with damage under it for every item-set
 * variant (one row per variant, top row = the primary variant). */
export function TimelineList({
  comboNodeId,
  steps,
  connectedSources,
  variants,
  target,
}: {
  readonly comboNodeId: string
  readonly steps: readonly ComboStep[]
  readonly connectedSources: readonly ConnectedItemSetSource[]
  readonly variants: readonly ComboVariant[]
  readonly target: TargetSpec | undefined
}) {
  const snapshot = useSnapshotContext()
  const reorderComboSteps = useGraphStore((s) => s.reorderComboSteps)
  const removeComboStep = useGraphStore((s) => s.removeComboStep)
  const restoreComboStep = useGraphStore((s) => s.restoreComboStep)
  const toast = useToast()

  const sensors = useSensors(
    useSensor(PointerSensor),
    useSensor(KeyboardSensor, { coordinateGetter: sortableKeyboardCoordinates }),
  )

  if (steps.length === 0) {
    return (
      <p className={styles.emptyState}>
        {connectedSources.length === 0
          ? "Connect an item set to start a combo."
          : "Click an ability above to add a step."}
      </p>
    )
  }

  const primaryKits = variants[0]?.kits ?? {}
  const keyLabelsByChampion = new Map(
    Object.entries(primaryKits).map(([id, kit]) => [id, actionKeyLabels(kit.actions)] as const),
  )
  const outcomes = variants.map((variant) => simulateVariant(variant, target))
  const showVariantNames = outcomes.length > 1

  function handleDragEnd(event: DragEndEvent) {
    const { active, over } = event
    if (over === null || active.id === over.id) {
      return
    }
    const fromIndex = steps.findIndex((step) => step.id === active.id)
    const toIndex = steps.findIndex((step) => step.id === over.id)
    if (fromIndex !== -1 && toIndex !== -1) {
      reorderComboSteps(comboNodeId, fromIndex, toIndex)
    }
  }

  function handleDelete(step: ComboStep, index: number) {
    removeComboStep(comboNodeId, step.id)
    toast.show({
      message: "Step removed",
      actionLabel: "Undo",
      onAction: () => restoreComboStep(comboNodeId, step, index),
    })
  }

  return (
    <div className={styles.timeline}>
      <DndContext sensors={sensors} collisionDetection={closestCenter} onDragEnd={handleDragEnd}>
        <SortableContext
          items={steps.map((step) => step.id)}
          strategy={horizontalListSortingStrategy}
        >
          <ul className={cx(styles.timelineList, "nowheel")}>
            {steps.map((step, index) => {
              const championNodeId = resolveStepChampionNodeId(step, connectedSources)
              const championItemSets = connectedSources.filter(
                (source) => source.championNode.id === championNodeId,
              )
              const championNode = championItemSets[0]?.championNode
              const champion = snapshot.champions.find(
                (c) => c.id === championNode?.data.championId,
              )
              const kit = championNodeId === undefined ? undefined : primaryKits[championNodeId]
              const action = kit?.actions.find((a) => a.id === step.actionId)
              const damages: StepDamage[] = outcomes.map(({ variant, pointByStepId }) => ({
                variantId: variant.variantId,
                variantName: variant.variantName,
                point: pointByStepId.get(step.id),
              }))
              return (
                <TimelineEntry
                  key={step.id}
                  comboNodeId={comboNodeId}
                  step={step}
                  index={index}
                  actionLabel={action?.label ?? step.actionId}
                  iconUrl={
                    champion === undefined || action === undefined
                      ? undefined
                      : abilityIconUrl(champion, action)
                  }
                  keyLabel={
                    (championNodeId === undefined
                      ? undefined
                      : keyLabelsByChampion.get(championNodeId)?.get(step.actionId)) ??
                    step.actionId
                  }
                  itemSetIds={championItemSets.map((source) => source.itemSetId)}
                  orphaned={isStepOrphaned(step, connectedSources, primaryKits)}
                  damages={damages}
                  onDelete={() => handleDelete(step, index)}
                />
              )
            })}
          </ul>
        </SortableContext>
      </DndContext>
      <div className={styles.runningTotals}>
        {outcomes.map(({ variant, total }) => (
          <div key={variant.variantId} className={styles.runningTotal}>
            <span>{showVariantNames ? variant.variantName : "Total"}</span>
            <span className="num">{Math.round(total).toLocaleString()}</span>
          </div>
        ))}
      </div>
    </div>
  )
}
