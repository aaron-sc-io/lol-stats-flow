import type { Snapshot } from "@/data/schema"
import { buildChartPoints, type ChartPoint, originPoint } from "./chart-points"
import { buildComboVariants } from "./combo-variants"
import { buildComparisonRow, type ComparisonRow } from "./comparison-row"
import { getConnectedComboIds, getConnectedItemSetSources } from "./selectors"
import { getOrSimulate } from "./sim-cache"
import type { FlowEdge, FlowNode, GraphNodeData } from "./types"

export type ComboSeries = {
  readonly seriesId: string
  readonly comboId: string
  readonly comboName: string
  /** Which of the combo's item-set variants this line plots (see
   * `ComboVariant`) — lines of the same variant share a color. */
  readonly variantId: string
  readonly variantName: string
  readonly targetId: string
  readonly targetName: string
  readonly itemSetIds: readonly string[]
  readonly stepIds: readonly string[]
  readonly points: readonly ChartPoint[]
}

export type GraphNodeDerivedData = {
  readonly series: readonly ComboSeries[]
  readonly rows: readonly ComparisonRow[]
}

/** `"Combo 1 · Infinity Edge"` — the combo name plus which item sets the
 * line was simulated with. */
export function seriesLabel(series: Pick<ComboSeries, "comboName" | "variantName">): string {
  return series.variantName === ""
    ? series.comboName
    : `${series.comboName} · ${series.variantName}`
}

/** Everything a GraphNode renders — the chart series (against the active
 * targets only) and the comparison table rows (every target) — for every
 * connected combo × each of its item-set variants, derived live from the
 * combos' own steps/kits, never stored (plan §5). */
export function deriveGraphNodeData(
  graphNodeId: string,
  graphData: GraphNodeData,
  nodes: readonly FlowNode[],
  edges: readonly FlowEdge[],
  snapshot: Snapshot,
): GraphNodeDerivedData {
  const comboIds = getConnectedComboIds(graphNodeId, edges)
  const selectedTargetIds = new Set(graphData.activeTargetIds)
  const activeTargets = graphData.targets.filter((target) => selectedTargetIds.has(target.id))
  const chartTargets = activeTargets.length === 0 ? graphData.targets.slice(0, 1) : activeTargets

  const series: ComboSeries[] = []
  const rows: ComparisonRow[] = []

  for (const comboId of comboIds) {
    const comboNode = nodes.find((node) => node.id === comboId)
    if (comboNode === undefined || comboNode.type !== "combo") {
      continue
    }
    const sources = getConnectedItemSetSources(comboId, nodes, edges)
    const variants = buildComboVariants(snapshot, sources, comboNode.data.steps)

    for (const variant of variants) {
      const { steps, kits } = variant
      const stepIds = steps.map((step) => step.id)
      const combo = {
        comboId,
        comboName: comboNode.data.name,
        variantId: variant.variantId,
        variantName: variant.variantName,
      }

      for (const target of chartTargets) {
        const result = getOrSimulate(steps, kits, target)
        series.push({
          ...combo,
          seriesId: `${comboId}__${variant.variantId}__${target.id}`,
          targetId: target.id,
          targetName: target.name,
          itemSetIds: variant.itemSetIds,
          stepIds,
          points: [
            originPoint(target, graphData.xMode),
            ...buildChartPoints(result, steps, target, graphData.xMode),
          ],
        })
      }

      for (const target of graphData.targets) {
        const result = getOrSimulate(steps, kits, target)
        rows.push(buildComparisonRow(combo, target, result, steps))
      }
    }
  }

  return { series, rows }
}
