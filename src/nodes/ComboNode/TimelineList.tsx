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
  SortableContext,
  sortableKeyboardCoordinates,
  verticalListSortingStrategy,
} from "@dnd-kit/sortable"
import { useToast } from "@/components/Toast"
import { useSnapshotContext } from "@/data/snapshot-context"
import type { ComboStep, Kit, TargetSpec } from "@/engine"
import { buildChartPoints } from "@/graph/chart-points"
import type { ConnectedItemSetSource } from "@/graph/selectors"
import { isStepOrphaned } from "@/graph/selectors"
import { getOrSimulate } from "@/graph/sim-cache"
import { useGraphStore } from "@/graph/store"
import styles from "./ComboNode.module.css"
import { TimelineEntry } from "./TimelineEntry"

export function TimelineList({
  comboNodeId,
  steps,
  connectedSources,
  kits,
  target,
}: {
  readonly comboNodeId: string
  readonly steps: readonly ComboStep[]
  readonly connectedSources: readonly ConnectedItemSetSource[]
  readonly kits: Readonly<Record<string, Kit>>
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

  const connectedSteps = steps.filter((step) => !isStepOrphaned(step, connectedSources, kits))
  const result = target === undefined ? undefined : getOrSimulate(connectedSteps, kits, target)
  const chartPoints =
    result === undefined || target === undefined
      ? []
      : buildChartPoints(result, connectedSteps, target, "step")
  const chartPointByStepId = new Map(
    connectedSteps.map((step, index) => [step.id, chartPoints[index]]),
  )
  const total = result?.instances.reduce((sum, instance) => sum + instance.mitigated, 0) ?? 0

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
    <div className="nowheel">
      <DndContext sensors={sensors} collisionDetection={closestCenter} onDragEnd={handleDragEnd}>
        <SortableContext
          items={steps.map((step) => step.id)}
          strategy={verticalListSortingStrategy}
        >
          <ul className={styles.timelineList}>
            {steps.map((step, index) => {
              const source = connectedSources.find((s) => s.itemSetId === step.sourceId)
              const champion = snapshot.champions.find(
                (c) => c.id === source?.championNode.data.championId,
              )
              const action = kits[step.sourceId]?.actions.find((a) => a.id === step.actionId)
              return (
                <TimelineEntry
                  key={step.id}
                  comboNodeId={comboNodeId}
                  step={step}
                  index={index}
                  actionLabel={action?.label ?? step.actionId}
                  championName={champion?.name ?? "?"}
                  orphaned={isStepOrphaned(step, connectedSources, kits)}
                  chartPoint={chartPointByStepId.get(step.id)}
                  onDelete={() => handleDelete(step, index)}
                />
              )
            })}
          </ul>
        </SortableContext>
      </DndContext>
      <div className={styles.runningTotal}>
        <span>Total</span>
        <span className="num">{Math.round(total).toLocaleString()}</span>
      </div>
    </div>
  )
}
