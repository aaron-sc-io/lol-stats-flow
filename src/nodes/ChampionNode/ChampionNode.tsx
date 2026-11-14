import type { NodeProps } from "@xyflow/react"
import { NodeResizer, useInternalNode, useUpdateNodeInternals } from "@xyflow/react"
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
 * [item-sets column]`. Resizes aspect-locked only (plan D6) — `NodeResizer`
 * with `keepAspectRatio`; every internal size is `calc(<token> *
 * var(--node-scale))`, where `--node-scale = currentWidth / BASE_WIDTH`.
 */
export function ChampionNode({ id, data, selected }: NodeProps<ChampionFlowNode>) {
  const snapshot = useSnapshotContext()
  const nodes = useGraphStore((s) => s.nodes)
  const edges = useGraphStore((s) => s.edges)
  const hoveredComboId = useGraphStore((s) => s.hoveredComboId)
  const setChampionId = useGraphStore((s) => s.setChampionId)
  const setChampionLevel = useGraphStore((s) => s.setChampionLevel)
  const addItemSet = useGraphStore((s) => s.addItemSet)
  const updateNodeInternals = useUpdateNodeInternals()
  // `NodeProps.width` (and `getNodeDimensions()` generally) prioritizes
  // `node.measured.width` over the explicit resize width — exactly wrong
  // here, since that would feed the *rendered* (scale-dependent) size back
  // into the scale that drives it, shrinking the node every render until
  // it collapses to its CSS `min-width`. `useInternalNode` exposes the raw
  // node record, where `.width` is ONLY ever set by an actual user resize
  // (`NodeResizer`'s `dimensions` change), so it stays `undefined` — and
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
    () => computeHighlightState(nodes, edges, hoveredComboId),
    [nodes, edges, hoveredComboId],
  )
  const highlighted = highlight.highlightedNodeIds.has(id)
  const dimmed = highlight.dimmedNodeIds.has(id)

  return (
    <>
      <NodeResizer
        isVisible={selected === true}
        keepAspectRatio
        minWidth={MIN_WIDTH}
        maxWidth={MAX_WIDTH}
        handleClassName={cx(styles.resizeHandle)}
        lineClassName={cx(styles.resizeLine)}
      />
      <NodeFrame
        label="Champion"
        title={champion?.name ?? "Unknown champion"}
        selected={selected}
        highlighted={highlighted}
        dimmed={dimmed}
        width={currentWidth}
        style={frameStyle}
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
                max={18}
                onChange={(level) => setChampionLevel(id, level)}
                aria-label="Champion level"
              />
            </div>
          </div>
          <div className={styles.itemSetsColumn}>
            {data.itemSets.map((itemSet) => (
              <ItemSetRow
                key={itemSet.id}
                championNodeId={id}
                itemSet={itemSet}
                snapshot={snapshot}
              />
            ))}
            <Button variant="ghost" onClick={() => addItemSet(id)}>
              + Add item set
            </Button>
          </div>
        </div>
      </NodeFrame>
    </>
  )
}
