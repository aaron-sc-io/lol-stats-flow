import type { NodeProps } from "@xyflow/react"
import { Handle, Position } from "@xyflow/react"
import { useMemo } from "react"
import { Listbox } from "@/components/Listbox"
import { NodeFrame } from "@/components/NodeFrame"
import { SegmentedControl } from "@/components/SegmentedControl"
import { useSnapshotContext } from "@/data/snapshot-context"
import { deriveGraphNodeData } from "@/graph/graph-node-derivation"
import { GRAPH_COMBOS_HANDLE } from "@/graph/handle-ids"
import { useGraphStore } from "@/graph/store"
import type { ChartType, GraphFlowNode, XMode } from "@/graph/types"
import { cx } from "@/lib/cx"
import { ComparisonTable } from "./ComparisonTable"
import { DamageChart } from "./DamageChart"
import styles from "./GraphNode.module.css"
import { TargetsPanel } from "./TargetsPanel"

const DEFAULT_WIDTH = 640

const CHART_TYPE_OPTIONS: ReadonlyArray<{ readonly value: ChartType; readonly label: string }> = [
  { value: "bars", label: "Per-step bars" },
  { value: "cumulative", label: "Cumulative" },
  { value: "hp", label: "Target HP" },
]

const X_MODE_OPTIONS: ReadonlyArray<{ readonly value: XMode; readonly label: string }> = [
  { value: "step", label: "Step" },
  { value: "tick", label: "Tick" },
]

/**
 * Graph node (plan §6, deliverable 5): chart/x-axis/target controls, the
 * targets panel, the per-combo damage chart, and the comparison table.
 */
export function GraphNode({ id, data, selected }: NodeProps<GraphFlowNode>) {
  const snapshot = useSnapshotContext()
  const nodes = useGraphStore((s) => s.nodes)
  const edges = useGraphStore((s) => s.edges)
  const setActiveTarget = useGraphStore((s) => s.setActiveTarget)
  const setChartType = useGraphStore((s) => s.setChartType)
  const setXMode = useGraphStore((s) => s.setXMode)

  const { series, rows } = useMemo(
    () => deriveGraphNodeData(id, data, nodes, edges, snapshot),
    [id, data, nodes, edges, snapshot],
  )

  const activeTarget = data.targets.find((target) => target.id === data.activeTargetId) ?? null

  return (
    <NodeFrame label="Graph" title="Graph" selected={selected} width={DEFAULT_WIDTH}>
      <div className={cx(styles.body, "nodrag")}>
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
          <Listbox
            items={data.targets}
            value={activeTarget}
            onChange={(target) => setActiveTarget(id, target.id)}
            getKey={(target) => target.id}
            getLabel={(target) => target.name}
            aria-label="Active target"
            placeholder="Select a target"
          />
        </div>

        <TargetsPanel graphNodeId={id} targets={data.targets} />

        <DamageChart series={series} chartType={data.chartType} />

        <ComparisonTable rows={rows} />
      </div>
      <Handle type="target" position={Position.Left} id={GRAPH_COMBOS_HANDLE} />
    </NodeFrame>
  )
}
