import type { NodeProps } from "@xyflow/react"
import { Handle, Position, useInternalNode } from "@xyflow/react"
import { useMemo } from "react"
import { EditableText } from "@/components/EditableText"
import { NodeFrame } from "@/components/NodeFrame"
import { useSnapshotContext } from "@/data/snapshot-context"
import { buildComboVariants, groupSourcesByChampion } from "@/graph/combo-variants"
import { COMBO_OUT_HANDLE, COMBO_SOURCES_HANDLE } from "@/graph/handle-ids"
import {
  computeHighlightState,
  getConnectedGraphTarget,
  getConnectedItemSetSources,
} from "@/graph/selectors"
import { getOrSimulate } from "@/graph/sim-cache"
import { useGraphStore } from "@/graph/store"
import type { ComboFlowNode } from "@/graph/types"
import { cx } from "@/lib/cx"
import { AbilityPaletteSection } from "./AbilityPaletteSection"
import styles from "./ComboNode.module.css"
import { TimelineList } from "./TimelineList"

const DEFAULT_WIDTH = 480
const MIN_WIDTH = 280
const MAX_WIDTH = 1600

/**
 * Combo node (plan §6, deliverable 4): one single-row ability palette per
 * connected champion + the horizontal drag-reorderable step timeline. The
 * step list is replayed once per item-set variant (`buildComboVariants`),
 * each one a separate function on the connected graph.
 */
export function ComboNode({ id, data, selected }: NodeProps<ComboFlowNode>) {
  const snapshot = useSnapshotContext()
  const nodes = useGraphStore((s) => s.nodes)
  const edges = useGraphStore((s) => s.edges)
  const hoveredComboId = useGraphStore((s) => s.hoveredComboId)
  const hoveredItemSetIds = useGraphStore((s) => s.hoveredItemSetIds)
  const setHoveredCombo = useGraphStore((s) => s.setHoveredCombo)
  const renameCombo = useGraphStore((s) => s.renameCombo)
  const toggleComboSectionCollapsed = useGraphStore((s) => s.toggleComboSectionCollapsed)
  const removeNode = useGraphStore((s) => s.removeNode)
  const duplicateNode = useGraphStore((s) => s.duplicateNode)
  const internalNode = useInternalNode<ComboFlowNode>(id)
  const nodeWidth = internalNode?.width ?? DEFAULT_WIDTH

  const connectedSources = useMemo(
    () => getConnectedItemSetSources(id, nodes, edges),
    [id, nodes, edges],
  )
  const target = useMemo(() => getConnectedGraphTarget(id, nodes, edges), [id, nodes, edges])
  const variants = useMemo(
    () => buildComboVariants(snapshot, connectedSources, data.steps),
    [snapshot, connectedSources, data.steps],
  )
  const championSources = useMemo(
    () => groupSourcesByChampion(connectedSources),
    [connectedSources],
  )

  const highlight = useMemo(
    () => computeHighlightState(nodes, edges, hoveredComboId, hoveredItemSetIds),
    [nodes, edges, hoveredComboId, hoveredItemSetIds],
  )
  const highlighted = highlight.highlightedNodeIds.has(id)
  const dimmed = highlight.dimmedNodeIds.has(id)

  // The first variant uses each champion's first connected item set — it
  // backs the palette (ranks), orphan detection, and the header total.
  const primary = variants[0]
  const total =
    target === undefined || primary === undefined
      ? 0
      : getOrSimulate(primary.steps, primary.kits, target).instances.reduce(
          (sum, instance) => sum + instance.mitigated,
          0,
        )

  return (
    <NodeFrame
      label="Combo"
      title={
        <EditableText
          wrapperClassName={cx(styles.nameInput, "nodrag")}
          value={data.name}
          onChange={(event) => renameCombo(id, event.target.value)}
          aria-label="Combo name"
        />
      }
      selected={selected}
      highlighted={highlighted}
      dimmed={dimmed}
      width={nodeWidth}
      onPointerEnter={() => setHoveredCombo(id)}
      onPointerLeave={() => setHoveredCombo(null)}
      onDelete={() => removeNode(id)}
      onDuplicate={() => duplicateNode(id)}
      deleteLabel={`Delete ${data.name || "combo"} node`}
      resize={{
        minWidth: MIN_WIDTH,
        maxWidth: MAX_WIDTH,
      }}
      actions={
        target === undefined ? undefined : (
          <span className="num">{Math.round(total).toLocaleString()}</span>
        )
      }
    >
      <div className={cx(styles.body, "nodrag")}>
        {championSources.map((sources) => {
          const championNode = sources[0]?.championNode
          const kit = championNode === undefined ? undefined : primary?.kits[championNode.id]
          const champion = snapshot.champions.find((c) => c.id === championNode?.data.championId)
          if (championNode === undefined || kit === undefined || champion === undefined) {
            return null
          }
          return (
            <AbilityPaletteSection
              key={championNode.id}
              comboNodeId={id}
              sources={sources}
              kit={kit}
              champion={champion}
              isOpen={!data.collapsedSections.includes(championNode.id)}
              onToggle={() => toggleComboSectionCollapsed(id, championNode.id)}
            />
          )
        })}
        <TimelineList
          comboNodeId={id}
          steps={data.steps}
          connectedSources={connectedSources}
          variants={variants}
          target={target}
        />
      </div>
      <Handle type="target" position={Position.Left} id={COMBO_SOURCES_HANDLE} />
      <Handle type="source" position={Position.Right} id={COMBO_OUT_HANDLE} />
    </NodeFrame>
  )
}
