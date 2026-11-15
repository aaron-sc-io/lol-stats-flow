import type { Snapshot } from "@/data/schema"
import { abilityIconUrl, actionKeyLabels } from "@/nodes/ComboNode/AbilityPaletteSection"
import { buildChartPoints, type ChartPoint, originPoint } from "./chart-points"
import { buildComboVariants } from "./combo-variants"
import { buildComparisonRow, type ComparisonRow } from "./comparison-row"
import {
  buildKillMap,
  buildResistSweepPoints,
  type KillMapData,
  type SweepVariant,
  startingHp,
} from "./resist-sweep"
import {
  getConnectedComboIds,
  getConnectedItemSetSources,
  resolveStepChampionNodeId,
} from "./selectors"
import { getOrSimulate } from "./sim-cache"
import type { FlowEdge, FlowNode, GraphNodeData } from "./types"

export type StepIconMeta = {
  readonly stepId: string
  readonly actionId: string
  readonly actionLabel: string
  readonly iconUrl: string | undefined
  readonly keyLabel: string
}

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
  readonly stepIcons?: readonly StepIconMeta[] | undefined
  readonly points: readonly ChartPoint[]
  /** The target's starting HP — the kill line for resist sweeps. */
  readonly targetHp: number
}

/** A combo × item-set variant the kill map can compare. `key` is
 * `${comboId}__${variantId}`. */
export type VariantOption = { readonly key: string; readonly label: string }

export type GraphNodeDerivedData = {
  readonly series: readonly ComboSeries[]
  readonly rows: readonly ComparisonRow[]
  readonly variantOptions: readonly VariantOption[]
  /** Only in the "resists" graph's kill-map view, with ≥ 1 variant. */
  readonly killMap?: KillMapData | undefined
  readonly killMapA?: VariantOption | undefined
  readonly killMapB?: VariantOption | undefined
}

/** `"Combo 1 · Infinity Edge"` — the combo name plus which item sets the
 * line was simulated with. */
export function seriesLabel(series: Pick<ComboSeries, "comboName" | "variantName">): string {
  return series.variantName === ""
    ? series.comboName
    : `${series.comboName} · ${series.variantName}`
}

/** Step mode: the line ends at the step that killed the target — later
 * steps dealt nothing, so plotting them would only draw a flat tail. */
function truncateAfterKill(points: readonly ChartPoint[]): readonly ChartPoint[] {
  const killIndex = points.findIndex((point) => point.targetHpAfter <= 0)
  return killIndex === -1 ? points : points.slice(0, killIndex + 1)
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
  const graphKind = graphData.graphKind ?? "targets"
  const resistAxis = graphData.effective?.resistAxis ?? "armor"
  const variantOptions: VariantOption[] = []
  const sweepVariants = new Map<string, SweepVariant>()
  const comboIds = [...new Set(getConnectedComboIds(graphNodeId, edges))]
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
      const keyLabelsByChampion = new Map(
        Object.entries(kits).map(([id, kit]) => [id, actionKeyLabels(kit.actions)] as const),
      )
      const stepIcons: StepIconMeta[] = steps.map((step) => {
        const championNodeId = resolveStepChampionNodeId(step, sources)
        const championNode = sources.find(
          (source) => source.championNode.id === championNodeId,
        )?.championNode
        const champion = snapshot.champions.find((c) => c.id === championNode?.data.championId)
        const kit = championNodeId === undefined ? undefined : kits[championNodeId]
        const action = kit?.actions.find((a) => a.id === step.actionId)
        return {
          stepId: step.id,
          actionId: step.actionId,
          actionLabel: action?.label ?? step.actionId,
          iconUrl:
            champion === undefined || action === undefined
              ? undefined
              : abilityIconUrl(champion, action),
          keyLabel:
            (championNodeId === undefined
              ? undefined
              : keyLabelsByChampion.get(championNodeId)?.get(step.actionId)) ?? step.actionId,
        }
      })
      const combo = {
        comboId,
        comboName: comboNode.data.name,
        variantId: variant.variantId,
        variantName: variant.variantName,
      }

      const variantKey = `${comboId}__${variant.variantId}`
      variantOptions.push({ key: variantKey, label: seriesLabel(combo) })
      sweepVariants.set(variantKey, { steps, kits })

      for (const target of chartTargets) {
        const seriesBase = {
          ...combo,
          seriesId: `${comboId}__${variant.variantId}__${target.id}`,
          targetId: target.id,
          targetName: target.name,
          itemSetIds: variant.itemSetIds,
          stepIds,
          stepIcons,
          targetHp: startingHp(target),
        }
        if (graphKind === "resists") {
          // Simulated directly rather than through `getOrSimulate`, whose
          // small LRU a sweep would flush; the GraphNode memoizes this.
          series.push({
            ...seriesBase,
            points: buildResistSweepPoints(steps, kits, target, resistAxis),
          })
          continue
        }
        const result = getOrSimulate(steps, kits, target)
        const points = buildChartPoints(result, steps, target, graphData.xMode)
        series.push({
          ...seriesBase,
          points: [
            originPoint(target, graphData.xMode),
            ...(graphData.xMode === "step" ? truncateAfterKill(points) : points),
          ],
        })
      }

      if (graphKind === "resists") {
        continue
      }
      for (const target of graphData.targets) {
        const result = getOrSimulate(steps, kits, target)
        rows.push(buildComparisonRow(combo, target, result, steps))
      }
    }
  }

  const result: GraphNodeDerivedData = { series, rows, variantOptions }
  const [mapTarget, ...otherMapTargets] = chartTargets
  if (
    graphKind !== "resists" ||
    graphData.effective?.view !== "killMap" ||
    mapTarget === undefined
  ) {
    return result
  }
  const pick = (key: string | undefined, fallbackIndex: number) =>
    variantOptions.find((option) => option.key === key) ??
    variantOptions[Math.min(fallbackIndex, variantOptions.length - 1)]
  const optionA = pick(graphData.effective.killMapA, 0)
  const optionB = pick(graphData.effective.killMapB, 1)
  const variantA = optionA === undefined ? undefined : sweepVariants.get(optionA.key)
  const variantB = optionB === undefined ? undefined : sweepVariants.get(optionB.key)
  if (variantA === undefined || variantB === undefined) {
    return result
  }
  return {
    ...result,
    killMap: buildKillMap(variantA, variantB, [mapTarget, ...otherMapTargets], resistAxis),
    killMapA: optionA,
    killMapB: optionB,
  }
}
