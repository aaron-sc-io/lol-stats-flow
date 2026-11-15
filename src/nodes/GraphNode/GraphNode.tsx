import type { NodeProps } from "@xyflow/react"
import { Handle, Position, useInternalNode, useReactFlow } from "@xyflow/react"
import { useLayoutEffect, useMemo, useRef, useState } from "react"
import { NodeFrame } from "@/components/NodeFrame"
import { SegmentedControl } from "@/components/SegmentedControl"
import { useSnapshotContext } from "@/data/snapshot-context"
import { deriveGraphNodeData } from "@/graph/graph-node-derivation"
import { GRAPH_COMBOS_HANDLE } from "@/graph/handle-ids"
import { useGraphStore } from "@/graph/store"
import type { ChartType, EffectiveView, GraphFlowNode, ResistAxis, XMode } from "@/graph/types"
import { cx } from "@/lib/cx"
import { ChartResizeHandle } from "./ChartResizeHandle"
import { ComparisonTable } from "./ComparisonTable"
import { DamageChart } from "./DamageChart"
import {
  DEFAULT_CURSOR_RESIST,
  EffectiveDamageChart,
  EffectiveReadoutTable,
} from "./EffectiveDamageChart"
import styles from "./GraphNode.module.css"
import { KillMapChart } from "./KillMapChart"
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

const EFFECTIVE_VIEW_OPTIONS: ReadonlyArray<{
  readonly value: EffectiveView
  readonly label: string
}> = [
  { value: "curves", label: "Curves" },
  { value: "killMap", label: "Kill map" },
]

const RESIST_AXIS_OPTIONS: ReadonlyArray<{
  readonly value: ResistAxis
  readonly label: string
}> = [
  { value: "armor", label: "Armor" },
  { value: "magicResist", label: "MR" },
]

/**
 * Graph node (plan §6, deliverable 5): the targets panel, chart/x-axis/
 * target controls, the per-combo damage chart, and the comparison table.
 * Resizable as a whole (`NodeFrame` corner brackets; extra height goes to
 * the scrolling table), and the chart rescales on its own via its corner grip,
 * growing the node to fit. Sizes are view state, not saved with the canvas.
 */
export function GraphNode({ id, data, selected }: NodeProps<GraphFlowNode>) {
  const snapshot = useSnapshotContext()
  const nodes = useGraphStore((s) => s.nodes)
  const edges = useGraphStore((s) => s.edges)
  const toggleActiveTarget = useGraphStore((s) => s.toggleActiveTarget)
  const setAllTargetsActive = useGraphStore((s) => s.setAllTargetsActive)
  const setChartType = useGraphStore((s) => s.setChartType)
  const setXMode = useGraphStore((s) => s.setXMode)
  const setEffectiveSettings = useGraphStore((s) => s.setEffectiveSettings)
  const removeNode = useGraphStore((s) => s.removeNode)
  const duplicateNode = useGraphStore((s) => s.duplicateNode)
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
    const body = tableRegion.parentElement
    // `overflow` counts content spilling past a too-short fixed height
    // (offsetHeight alone can't see it), e.g. after a view switch.
    const measure = () => {
      const overflow = body === null ? 0 : Math.max(0, body.scrollHeight - body.clientHeight)
      setMinHeight(
        frame.offsetHeight -
          tableRegion.offsetHeight +
          overflow +
          Math.min(tableRegion.scrollHeight, MIN_TABLE_HEIGHT),
      )
    }
    measure()
    const observer = new ResizeObserver(measure)
    observer.observe(frame)
    observer.observe(tableRegion)
    // Content swaps (Curves ↔ Kill map) resize these, not the fixed frame.
    for (const child of Array.from(body?.children ?? [])) {
      observer.observe(child)
    }
    return () => observer.disconnect()
  }, [])

  // Switching views (e.g. Kill map → Curves) can raise the minimum above a
  // user-set height; grow the node so the chart/controls never spill out.
  useLayoutEffect(() => {
    if (nodeHeight !== undefined && nodeHeight < minHeight) {
      updateNode(id, { height: minHeight })
    }
  }, [id, nodeHeight, minHeight, updateNode])

  const [cursorResist, setCursorResist] = useState(DEFAULT_CURSOR_RESIST)

  const { series, rows, variantOptions, killMap, killMapA, killMapB } = useMemo(
    () => deriveGraphNodeData(id, data, nodes, edges, snapshot),
    [id, data, nodes, edges, snapshot],
  )

  const isEffective = data.graphKind === "resists"
  const effectiveView: EffectiveView = data.effective?.view ?? "curves"
  const resistAxis: ResistAxis = data.effective?.resistAxis ?? "armor"
  const showKillMap =
    isEffective &&
    effectiveView === "killMap" &&
    variantOptions.length >= 2 &&
    killMap !== undefined
  const hasChartContent = isEffective
    ? effectiveView === "killMap"
      ? showKillMap
      : series.length > 0
    : series.length > 0
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
    <NodeFrame
      ref={frameRef}
      label={isEffective ? "Graph: Effective Damage" : "Graph: Combo Damage vs Targets"}
      title={title}
      selected={selected}
      width={nodeWidth}
      style={nodeHeight === undefined ? undefined : { height: nodeHeight }}
      onDelete={() => removeNode(id)}
      onDuplicate={() => duplicateNode(id)}
      deleteLabel="Delete graph node"
      resize={{
        minWidth: MIN_WIDTH,
        maxWidth: MAX_WIDTH,
        minHeight,
      }}
    >
      <div className={cx(styles.body, "nodrag")}>
        <TargetsPanel
          graphNodeId={id}
          targets={data.targets}
          activeTargetIds={data.activeTargetIds}
          onToggleTarget={(targetId) => toggleActiveTarget(id, targetId)}
          onSelectAll={() => setAllTargetsActive(id)}
        />

        {isEffective ? (
          <div className={styles.controlsRow}>
            <SegmentedControl
              options={EFFECTIVE_VIEW_OPTIONS}
              value={effectiveView}
              onChange={(view) => setEffectiveSettings(id, { view })}
              aria-label="Effective damage view"
            />
            <SegmentedControl
              options={RESIST_AXIS_OPTIONS}
              value={resistAxis}
              onChange={(axis) => setEffectiveSettings(id, { resistAxis: axis })}
              aria-label="Resistance axis"
            />
            {effectiveView === "killMap" ? (
              <>
                <label className={styles.variantSelectGroup}>
                  <span className={styles.variantSelectLabel}>A</span>
                  <select
                    aria-label="A"
                    className={cx(styles.variantSelect, "nodrag")}
                    value={killMapA?.key ?? ""}
                    disabled={variantOptions.length === 0}
                    onChange={(event) => setEffectiveSettings(id, { killMapA: event.target.value })}
                  >
                    {variantOptions.map((option) => (
                      <option key={option.key} value={option.key}>
                        {option.label}
                      </option>
                    ))}
                  </select>
                </label>
                <label className={styles.variantSelectGroup}>
                  <span className={styles.variantSelectLabel}>B</span>
                  <select
                    aria-label="B"
                    className={cx(styles.variantSelect, "nodrag")}
                    value={killMapB?.key ?? ""}
                    disabled={variantOptions.length === 0}
                    onChange={(event) => setEffectiveSettings(id, { killMapB: event.target.value })}
                  >
                    {variantOptions.map((option) => (
                      <option key={option.key} value={option.key}>
                        {option.label}
                      </option>
                    ))}
                  </select>
                </label>
              </>
            ) : null}
          </div>
        ) : (
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
        )}

        <div className={styles.chartRegion}>
          {isEffective ? (
            effectiveView === "killMap" ? (
              showKillMap && killMap !== undefined ? (
                <KillMapChart
                  data={killMap}
                  labelA={killMapA?.label ?? "A"}
                  labelB={killMapB?.label ?? "B"}
                  height={chartHeight}
                />
              ) : (
                <p className={styles.emptyState}>
                  Connect two item sets (or combos) to compare kill regions.
                </p>
              )
            ) : (
              <EffectiveDamageChart
                graphNodeId={id}
                series={series}
                resistAxis={resistAxis}
                height={chartHeight}
                cursorResist={cursorResist}
                onCursorResistChange={setCursorResist}
              />
            )
          ) : (
            <DamageChart
              graphNodeId={id}
              series={series}
              chartType={data.chartType}
              xMode={data.xMode}
              seriesOverrides={data.seriesOverrides}
              height={chartHeight}
            />
          )}
          {hasChartContent ? (
            <ChartResizeHandle
              height={chartHeight}
              minHeight={MIN_CHART_HEIGHT}
              maxHeight={MAX_CHART_HEIGHT}
              onResizeStart={() => {
                chartResizeStart.current = { width: nodeWidth, height: nodeHeight, chartHeight }
              }}
              onResize={resizeChart}
            />
          ) : null}
        </div>

        <div ref={tableRegionRef} className={cx(styles.tableRegion, "nowheel")}>
          {isEffective ? (
            effectiveView === "curves" ? (
              <EffectiveReadoutTable
                series={series}
                seriesOverrides={data.seriesOverrides}
                cursorResist={cursorResist}
              />
            ) : null
          ) : (
            <ComparisonTable rows={rows} />
          )}
        </div>
      </div>
      <Handle type="target" position={Position.Left} id={GRAPH_COMBOS_HANDLE} />
    </NodeFrame>
  )
}
