import type { NodeProps } from "@xyflow/react"
import { useUpdateNodeInternals } from "@xyflow/react"
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

const DEFAULT_WIDTH = 560

/**
 * Champion node (plan §6, deliverable 3): `[portrait + name + level] |
 * [item-sets column]`. Functional now — aspect-locked `NodeResizer` scaling
 * is Phase 4b (plan D6); this renders at a fixed comfortable width.
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

  const champion = snapshot.champions.find((c) => c.id === data.championId)
  const itemSetIds = data.itemSets.map((itemSet) => itemSet.id).join(",")

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
    <NodeFrame
      label="Champion"
      title={champion?.name ?? "Unknown champion"}
      selected={selected}
      highlighted={highlighted}
      dimmed={dimmed}
      width={DEFAULT_WIDTH}
    >
      <div className={cx(styles.layout, "nodrag")}>
        <div className={styles.portraitColumn}>
          <RosterPicker
            snapshot={snapshot}
            championId={data.championId}
            onSelect={(next) => setChampionId(id, next.id)}
          />
          <span className={styles.name}>{champion?.name ?? "Unknown champion"}</span>
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
  )
}
