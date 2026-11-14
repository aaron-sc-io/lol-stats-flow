import type { Snapshot } from "@/data/schema"
import { buildChartPoints, type ChartPoint } from "./chart-points"
import { buildComparisonRow, type ComparisonRow } from "./comparison-row"
import { buildKitsForSources } from "./kit-cache"
import { getConnectedComboIds, getConnectedItemSetSources, isStepOrphaned } from "./selectors"
import { getOrSimulate } from "./sim-cache"
import type { FlowEdge, FlowNode, GraphNodeData } from "./types"

export type ComboSeries = {
  readonly comboId: string
  readonly comboName: string
  readonly points: readonly ChartPoint[]
}

export type GraphNodeDerivedData = {
  readonly series: readonly ComboSeries[]
  readonly rows: readonly ComparisonRow[]
}

/** Everything a GraphNode renders — the chart series (against the active
 * target only) and the comparison table rows (every connected combo ×
 * every target) — derived live from the connected combos' own steps/kits,
 * never stored (plan §5). */
export function deriveGraphNodeData(
  graphNodeId: string,
  graphData: GraphNodeData,
  nodes: readonly FlowNode[],
  edges: readonly FlowEdge[],
  snapshot: Snapshot,
): GraphNodeDerivedData {
  const comboIds = getConnectedComboIds(graphNodeId, edges)
  const activeTarget = graphData.targets.find((target) => target.id === graphData.activeTargetId)

  const series: ComboSeries[] = []
  const rows: ComparisonRow[] = []

  for (const comboId of comboIds) {
    const comboNode = nodes.find((node) => node.id === comboId)
    if (comboNode === undefined || comboNode.type !== "combo") {
      continue
    }
    const sources = getConnectedItemSetSources(comboId, nodes, edges)
    const kits = buildKitsForSources(snapshot, sources)
    const steps = comboNode.data.steps.filter((step) => !isStepOrphaned(step, sources, kits))

    if (activeTarget !== undefined) {
      const result = getOrSimulate(steps, kits, activeTarget)
      series.push({
        comboId,
        comboName: comboNode.data.name,
        points: buildChartPoints(result, steps, activeTarget, graphData.xMode),
      })
    }

    for (const target of graphData.targets) {
      const result = getOrSimulate(steps, kits, target)
      rows.push(buildComparisonRow(comboId, comboNode.data.name, target, result, steps))
    }
  }

  return { series, rows }
}
