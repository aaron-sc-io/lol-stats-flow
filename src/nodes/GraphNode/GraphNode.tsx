import type { NodeProps } from "@xyflow/react"
import { Handle, NodeResizer, Position, useInternalNode, useReactFlow } from "@xyflow/react"
import { useLayoutEffect, useMemo, useRef, useState } from "react"
import { NodeFrame } from "@/components/NodeFrame"
import { SegmentedControl } from "@/components/SegmentedControl"
import { useSnapshotContext } from "@/data/snapshot-context"
import { deriveGraphNodeData } from "@/graph/graph-node-derivation"
import { GRAPH_COMBOS_HANDLE } from "@/graph/handle-ids"
import { useGraphStore } from "@/graph/store"
import type { ChartType, GraphFlowNode, XMode } from "@/graph/types"
import { cx } from "@/lib/cx"
import { ChartResizeHandle } from "./ChartResizeHandle"
import { ComparisonTable } from "./ComparisonTable"
import { DamageChart } from "./DamageChart"
import styles from "./GraphNode.module.css"
import { TargetsPanel } from "./TargetsPanel"

const DEFAULT_WIDTH = 800
const MIN_WIDTH = 480
const MAX_WIDTH = 2400
const DEFAULT_CHART_HEIGHT = 260
const MIN_CHART_HEIGHT = 160
const MAX_CHART_HEIGHT = 1200
const MIN_TABLE_HEIGHT = 96

function clamp(value: number, min: number, max: number): number {
  return Math.min(max, Math.max(min, value))
}

const CHART_TYPE_OPTIONS: ReadonlyArray<{ readonly value: ChartType; readonly label: string }> = [
  { value: "cumulative", label: "Cumulative" },
  { value: "hp", label: "Target HP" },
]

const X_MODE_OPTIONS: ReadonlyArray<{ readonly value: XMode; readonly label: string }> = [
  { value: "step", label: "Step" },
  { value: "tick", label: "Tick" },
]

/**
 * Graph node (plan §6, deliverable 5): the targets panel, chart/x-axis/
 * target controls, the per-combo damage chart, and the comparison table.
 * Resizable as a whole (`NodeResizer`; extra height goes to the scrolling
 * table), and the chart rescales on its own via its corner grip, growing
 * the node to fit. Sizes are view state, not saved with the canvas.
 */
export function GraphNode({ id, data, selected }: NodeProps<GraphFlowNode>) {
  const snapshot = useSnapshotContext()
  const nodes = useGraphStore((s) => s.nodes)
  const edges = useGraphStore((s) => s.edges)
  const toggleActiveTarget = useGraphStore((s) => s.toggleActiveTarget)
  const setAllTargetsActive = useGraphStore((s) => s.setAllTargetsActive)
  const setChartType = useGraphStore((s) => s.setChartType)
  const setXMode = useGraphStore((s) => s.setXMode)
  const { updateNode } = useReactFlow()
  // The raw node record: `.width`/`.height` are set only by an actual user
  // resize (see ChampionNode for why `NodeProps.width` can't be used).
  const internalNode = useInternalNode<GraphFlowNode>(id)
  const nodeWidth = internalNode?.width ?? DEFAULT_WIDTH
  const nodeHeight = internalNode?.height
  const [chartHeight, setChartHeight] = useState(DEFAULT_CHART_HEIGHT)
  const chartResizeStart = useRef({ width: nodeWidth, height: nodeHeight, chartHeight })

  // The node may shrink until only MIN_TABLE_HEIGHT of the (scrolling)
  // comparison table is left — never into the chart or controls above it.
  const frameRef = useRef<HTMLDivElement>(null)
  const tableRegionRef = useRef<HTMLDivElement>(null)
  const [minHeight, setMinHeight] = useState(0)
  useLayoutEffect(() => {
    const frame = frameRef.current
    const tableRegion = tableRegionRef.current
    if (frame === null || tableRegion === null) {
      return
    }
    const measure = () =>
      setMinHeight(
        frame.offsetHeight -
          tableRegion.offsetHeight +
          Math.min(tableRegion.scrollHeight, MIN_TABLE_HEIGHT),
      )
    measure()
    const observer = new ResizeObserver(measure)
    observer.observe(frame)
    observer.observe(tableRegion)
    return () => observer.disconnect()
  }, [])

  const { series, rows } = useMemo(
    () => deriveGraphNodeData(id, data, nodes, edges, snapshot),
    [id, data, nodes, edges, snapshot],
  )

  const activeTargetIds = new Set(data.activeTargetIds)
  const activeTargets = data.targets.filter((target) => activeTargetIds.has(target.id))
  const title =
    activeTargets.length === 0
      ? "No target"
      : activeTargets.length === 1
        ? `vs ${activeTargets[0]?.name ?? ""}`
        : `vs ${activeTargets[0]?.name ?? ""} +${activeTargets.length - 1}`

  // Rescaling the chart grows/shrinks the node with it: dragging wider
  // widens the node (the chart always spans it), dragging taller adds the
  // same height to a height-resized node so the table below keeps its room.
  const resizeChart = (deltaWidth: number, deltaHeight: number) => {
    const start = chartResizeStart.current
    const nextChartHeight = clamp(
      start.chartHeight + deltaHeight,
      MIN_CHART_HEIGHT,
      MAX_CHART_HEIGHT,
    )
    setChartHeight(nextChartHeight)
    updateNode(id, {
      width: clamp(start.width + deltaWidth, MIN_WIDTH, MAX_WIDTH),
      ...(start.height === undefined
        ? {}
        : { height: start.height + nextChartHeight - start.chartHeight }),
    })
  }

  return (
    <>
      <NodeResizer
        isVisible={selected === true}
        minWidth={MIN_WIDTH}
        maxWidth={MAX_WIDTH}
        minHeight={minHeight}
        handleClassName={cx(styles.resizeHandle)}
        lineClassName={cx(styles.resizeLine)}
      />
      <NodeFrame
        ref={frameRef}
        label="Graph"
        title={title}
        selected={selected}
        width={nodeWidth}
        style={nodeHeight === undefined ? undefined : { height: nodeHeight }}
      >
        <div className={cx(styles.body, "nodrag")}>
          <TargetsPanel
            graphNodeId={id}
            targets={data.targets}
            activeTargetIds={data.activeTargetIds}
            onToggleTarget={(targetId) => toggleActiveTarget(id, targetId)}
            onSelectAll={() => setAllTargetsActive(id)}
          />

          <div className={styles.controlsRow}>
            <SegmentedControl
              options={CHART_TYPE_OPTIONS}
              value={data.chartType}
              onChange={(value) => setChartType(id, value)}
              aria-label="Chart type"
            />
            <SegmentedControl
              options={X_MODE_OPTIONS}
              value={data.xMode}
              onChange={(value) => setXMode(id, value)}
              aria-label="X-axis mode"
            />
          </div>

          <div className={styles.chartRegion}>
            <DamageChart series={series} chartType={data.chartType} height={chartHeight} />
            {series.length === 0 ? null : (
              <ChartResizeHandle
                height={chartHeight}
                minHeight={MIN_CHART_HEIGHT}
                maxHeight={MAX_CHART_HEIGHT}
                onResizeStart={() => {
                  chartResizeStart.current = { width: nodeWidth, height: nodeHeight, chartHeight }
                }}
                onResize={resizeChart}
              />
            )}
          </div>

          <div ref={tableRegionRef} className={cx(styles.tableRegion, "nowheel")}>
            <ComparisonTable rows={rows} />
          </div>
        </div>
        <Handle type="target" position={Position.Left} id={GRAPH_COMBOS_HANDLE} />
      </NodeFrame>
    </>
  )
}
