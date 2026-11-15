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
import type { NodeProps } from "@xyflow/react"
import { useInternalNode, useUpdateNodeInternals } from "@xyflow/react"
import type { CSSProperties } from "react"
import { useEffect, useMemo } from "react"
import { Button } from "@/components/Button"
import { NodeFrame } from "@/components/NodeFrame"
import { Slider } from "@/components/Slider"
import { useSnapshotContext } from "@/data/snapshot-context"
import { computeHighlightState } from "@/graph/selectors"
import { useGraphStore } from "@/graph/store"
import type { ChampionFlowNode } from "@/graph/types"
import { cx } from "@/lib/cx"
import styles from "./ChampionNode.module.css"
import { ItemSetRow } from "./ItemSetRow"
import { RosterPicker } from "./RosterPicker"

const BASE_WIDTH = 560
const MIN_WIDTH = 360
const MAX_WIDTH = 900

/**
 * Champion node (plan §6, deliverable 3): `[portrait + name + level] |
 * [item-sets column]`. Resizes aspect-locked only (plan D6) — `NodeFrame`
 * corner brackets with `keepAspectRatio`; every internal size is `calc(<token> *
 * var(--node-scale))`, where `--node-scale = currentWidth / BASE_WIDTH`.
 * Only the width is ever pinned by a resize (see `onNodesChange` in
 * `flow-slice.ts`); height always follows the content.
 */
export function ChampionNode({ id, data, selected }: NodeProps<ChampionFlowNode>) {
  const snapshot = useSnapshotContext()
  const nodes = useGraphStore((s) => s.nodes)
  const edges = useGraphStore((s) => s.edges)
  const hoveredComboId = useGraphStore((s) => s.hoveredComboId)
  const hoveredItemSetIds = useGraphStore((s) => s.hoveredItemSetIds)
  const setChampionId = useGraphStore((s) => s.setChampionId)
  const setChampionLevel = useGraphStore((s) => s.setChampionLevel)
  const addItemSet = useGraphStore((s) => s.addItemSet)
  const removeNode = useGraphStore((s) => s.removeNode)
  const duplicateNode = useGraphStore((s) => s.duplicateNode)
  const reorderItemSets = useGraphStore((s) => s.reorderItemSets)
  const sensors = useSensors(
    useSensor(PointerSensor),
    useSensor(KeyboardSensor, { coordinateGetter: sortableKeyboardCoordinates }),
  )
  const handleItemSetDragEnd = ({ active, over }: DragEndEvent) => {
    if (over === null || active.id === over.id) {
      return
    }
    const fromIndex = data.itemSets.findIndex((itemSet) => itemSet.id === active.id)
    const toIndex = data.itemSets.findIndex((itemSet) => itemSet.id === over.id)
    if (fromIndex !== -1 && toIndex !== -1) {
      reorderItemSets(id, fromIndex, toIndex)
    }
  }
  const updateNodeInternals = useUpdateNodeInternals()
  // `NodeProps.width` (and `getNodeDimensions()` generally) prioritizes
  // `node.measured.width` over the explicit resize width — exactly wrong
  // here, since that would feed the *rendered* (scale-dependent) size back
  // into the scale that drives it, shrinking the node every render until
  // it collapses to its CSS `min-width`. `useInternalNode` exposes the raw
  // node record, where `.width` is ONLY ever set by an actual user resize
  // (`NodeResizeControl`'s `dimensions` change), so it stays `undefined` — and
  // the node renders at `BASE_WIDTH` — until the user has actually dragged
  // the resizer.
  const internalNode = useInternalNode<ChampionFlowNode>(id)

  const champion = snapshot.champions.find((c) => c.id === data.championId)
  const itemSetIds = data.itemSets.map((itemSet) => itemSet.id).join(",")
  const currentWidth = internalNode?.width ?? BASE_WIDTH
  const nodeScale = currentWidth / BASE_WIDTH
  const frameStyle = { "--node-scale": nodeScale } as CSSProperties

  // Each item-set row owns its own source `<Handle>` (plan D6). React Flow
  // only measures a node's handle bounds on mount/resize — it has no way
  // to know a *dynamically added or removed* handle inside an
  // already-mounted node appeared, so edges touching a freshly added row's
  // handle would silently fail to render (and new connections to it could
  // never resolve a path) without this explicit re-measure.
  // biome-ignore lint/correctness/useExhaustiveDependencies: itemSetIds is a deliberate trigger-only dep (re-run when the set of handles changes), not read in the body.
  useEffect(() => {
    updateNodeInternals(id)
  }, [id, itemSetIds, updateNodeInternals])

  const highlight = useMemo(
    () => computeHighlightState(nodes, edges, hoveredComboId, hoveredItemSetIds),
    [nodes, edges, hoveredComboId, hoveredItemSetIds],
  )
  const highlighted = highlight.highlightedNodeIds.has(id)
  const dimmed = highlight.dimmedNodeIds.has(id)
  const championName = champion?.name ?? "Unknown champion"

  return (
    <NodeFrame
      label="Champion"
      title={championName}
      selected={selected}
      highlighted={highlighted}
      dimmed={dimmed}
      width={currentWidth}
      style={frameStyle}
      onDelete={() => removeNode(id)}
      onDuplicate={() => duplicateNode(id)}
      deleteLabel={`Delete ${championName} node`}
      resize={{
        keepAspectRatio: true,
        minWidth: MIN_WIDTH,
        maxWidth: MAX_WIDTH,
      }}
    >
      <div className={cx(styles.layout, "nodrag")}>
        <div className={styles.portraitColumn}>
          <RosterPicker
            snapshot={snapshot}
            championId={data.championId}
            onSelect={(next) => setChampionId(id, next.id)}
          />
          <div className={styles.levelRow}>
            <span className={styles.levelLabel}>Level</span>
            <Slider
              value={data.level}
              min={1}
              max={20}
              onChange={(level) => setChampionLevel(id, level)}
              aria-label="Champion level"
            />
          </div>
        </div>
        <div className={styles.itemSetsColumn}>
          <DndContext
            sensors={sensors}
            collisionDetection={closestCenter}
            onDragEnd={handleItemSetDragEnd}
          >
            <SortableContext
              items={data.itemSets.map((itemSet) => itemSet.id)}
              strategy={verticalListSortingStrategy}
            >
              {data.itemSets.map((itemSet) => (
                <ItemSetRow
                  key={itemSet.id}
                  championNodeId={id}
                  itemSet={itemSet}
                  snapshot={snapshot}
                  highlighted={highlight.highlightedItemSetIds.has(itemSet.id)}
                />
              ))}
            </SortableContext>
          </DndContext>
          <Button variant="ghost" onClick={() => addItemSet(id)}>
            + Add item set
          </Button>
        </div>
      </div>
    </NodeFrame>
  )
}
