import type { NodeProps } from "@xyflow/react"
import { Handle, Position } from "@xyflow/react"
import { useMemo } from "react"
import { NodeFrame } from "@/components/NodeFrame"
import { useSnapshotContext } from "@/data/snapshot-context"
import { COMBO_OUT_HANDLE, COMBO_SOURCES_HANDLE } from "@/graph/handle-ids"
import { buildKitsForSources } from "@/graph/kit-cache"
import {
  computeHighlightState,
  getConnectedGraphTarget,
  getConnectedItemSetSources,
  isStepOrphaned,
} from "@/graph/selectors"
import { getOrSimulate } from "@/graph/sim-cache"
import { useGraphStore } from "@/graph/store"
import type { ComboFlowNode } from "@/graph/types"
import { cx } from "@/lib/cx"
import { AbilityPaletteSection } from "./AbilityPaletteSection"
import styles from "./ComboNode.module.css"
import { TimelineList } from "./TimelineList"

const DEFAULT_WIDTH = 380

/**
 * Combo node (plan §6, deliverable 4): per-connected-itemSet ability
 * palette + the drag-reorderable step timeline with a running total.
 */
export function ComboNode({ id, data, selected }: NodeProps<ComboFlowNode>) {
  const snapshot = useSnapshotContext()
  const nodes = useGraphStore((s) => s.nodes)
  const edges = useGraphStore((s) => s.edges)
  const hoveredComboId = useGraphStore((s) => s.hoveredComboId)
  const renameCombo = useGraphStore((s) => s.renameCombo)
  const toggleComboSectionCollapsed = useGraphStore((s) => s.toggleComboSectionCollapsed)

  const connectedSources = useMemo(
    () => getConnectedItemSetSources(id, nodes, edges),
    [id, nodes, edges],
  )
  const target = useMemo(() => getConnectedGraphTarget(id, nodes, edges), [id, nodes, edges])
  const kits = useMemo(
    () => buildKitsForSources(snapshot, connectedSources),
    [snapshot, connectedSources],
  )

  const highlight = useMemo(
    () => computeHighlightState(nodes, edges, hoveredComboId),
    [nodes, edges, hoveredComboId],
  )
  const highlighted = highlight.highlightedNodeIds.has(id)
  const dimmed = highlight.dimmedNodeIds.has(id)

  const connectedSteps = data.steps.filter((step) => !isStepOrphaned(step, connectedSources, kits))
  const total =
    target === undefined
      ? 0
      : getOrSimulate(connectedSteps, kits, target).instances.reduce(
          (sum, instance) => sum + instance.mitigated,
          0,
        )

  return (
    <NodeFrame
      label="Combo"
      title={
        <input
          type="text"
          className={styles.nameInput}
          value={data.name}
          onChange={(event) => renameCombo(id, event.target.value)}
          aria-label="Combo name"
        />
      }
      selected={selected}
      highlighted={highlighted}
      dimmed={dimmed}
      width={DEFAULT_WIDTH}
      actions={
        target === undefined ? undefined : (
          <span className="num">{Math.round(total).toLocaleString()}</span>
        )
      }
    >
      <div className={cx(styles.body, "nodrag")}>
        {connectedSources.map((source) => {
          const kit = kits[source.itemSetId]
          const champion = snapshot.champions.find(
            (c) => c.id === source.championNode.data.championId,
          )
          if (kit === undefined || champion === undefined) {
            return null
          }
          return (
            <AbilityPaletteSection
              key={source.itemSetId}
              comboNodeId={id}
              source={source}
              kit={kit}
              champion={champion}
              isOpen={!data.collapsedSections.includes(source.itemSetId)}
              onToggle={() => toggleComboSectionCollapsed(id, source.itemSetId)}
            />
          )
        })}
        <TimelineList
          comboNodeId={id}
          steps={data.steps}
          connectedSources={connectedSources}
          kits={kits}
          target={target}
        />
      </div>
      <Handle type="target" position={Position.Left} id={COMBO_SOURCES_HANDLE} />
      <Handle type="source" position={Position.Right} id={COMBO_OUT_HANDLE} />
    </NodeFrame>
  )
}
