import { CartesianGrid, LineChart, ResponsiveContainer, Tooltip, XAxis, YAxis } from "recharts"
import { type ComboSeries, seriesLabel } from "@/graph/graph-node-derivation"
import { useGraphStore } from "@/graph/store"
import type { HoveredDamage } from "@/graph/store-types"
import type { ChartType } from "@/graph/types"
import { cx } from "@/lib/cx"
import { ChartLegend } from "./ChartLegend"
import { ChartTooltip } from "./ChartTooltip"
import { ColoredLineSeries, type MergedRow } from "./ColoredLineSeries"
import styles from "./GraphNode.module.css"
import { MARKER_SHAPES, STROKE_DASHARRAYS } from "./SeriesDot"

const MIN_LABEL_MARGIN = 56
const MAX_LABEL_MARGIN = 220
const SERIES_COLORS = [
  "var(--text-primary)",
  "var(--dmg-magic)",
  "var(--dmg-physical)",
  "var(--text-secondary)",
] as const

function intersects(left: readonly string[], right: ReadonlySet<string>): boolean {
  return left.some((value) => right.has(value))
}

/** One shared dataset keyed by `x` (step index, or tick-mode seconds) with
 * per-combo keys — the canonical Recharts multi-series shape, robust
 * regardless of whether combos have different step counts or (in tick
 * mode) non-aligned instance times. */
export function mergeSeriesForChart(series: readonly ComboSeries[]): MergedRow[] {
  const byX = new Map<number, MergedRow>()
  for (const item of series) {
    for (const point of item.points) {
      const row: MergedRow = byX.get(point.x) ?? { x: point.x, xLabel: point.xLabel }
      row[`${item.seriesId}.physical`] = point.physical
      row[`${item.seriesId}.magic`] = point.magic
      row[`${item.seriesId}.true`] = point.true
      row[`${item.seriesId}.cumulative`] = point.cumulative
      row[`${item.seriesId}.targetHpAfter`] = point.targetHpAfter
      row[`${item.seriesId}.stepId`] = point.stepId ?? ""
      row[`${item.seriesId}.instances`] = point.instances
      byX.set(point.x, row)
    }
  }
  return [...byX.values()].sort((a, b) => a.x - b.x)
}

function lineDataKey(chartType: ChartType): "cumulative" | "targetHpAfter" {
  return chartType === "hp" ? "targetHpAfter" : "cumulative"
}

/** One color per combo × item-set variant; targets differ by dash pattern. */
function colorKey(item: ComboSeries): string {
  return `${item.comboId}__${item.variantId}`
}

export function DamageChart({
  series,
  chartType,
  height,
}: {
  readonly series: readonly ComboSeries[]
  readonly chartType: ChartType
  readonly height: number
}) {
  const hoveredComboId = useGraphStore((s) => s.hoveredComboId)
  const hoveredGraphSeriesId = useGraphStore((s) => s.hoveredGraphSeriesId)
  const hoveredStepId = useGraphStore((s) => s.hoveredStepId)
  const hoveredStepIds = useGraphStore((s) => s.hoveredStepIds)
  const hoveredItemSetIds = useGraphStore((s) => s.hoveredItemSetIds)
  const hoveredDamage = useGraphStore((s) => s.hoveredDamage)
  const setHoveredCombo = useGraphStore((s) => s.setHoveredCombo)
  const setHoveredGraphSeries = useGraphStore((s) => s.setHoveredGraphSeries)
  const setHoveredStep = useGraphStore((s) => s.setHoveredStep)
  const setHoveredSteps = useGraphStore((s) => s.setHoveredSteps)
  const setHoveredItemSet = useGraphStore((s) => s.setHoveredItemSet)
  const setHoveredItemSets = useGraphStore((s) => s.setHoveredItemSets)
  const setHoveredDamage = useGraphStore((s) => s.setHoveredDamage)

  if (series.length === 0) {
    return <p className={styles.emptyState}>Connect a combo to see its damage.</p>
  }

  const data = mergeSeriesForChart(series)
  // Room for the end-of-line labels (~6px per char at their 11px font).
  const labelMargin = Math.min(
    MAX_LABEL_MARGIN,
    Math.max(
      MIN_LABEL_MARGIN,
      12 + 6 * Math.max(...series.map((item) => seriesLabel(item).length)),
    ),
  )
  const colorBySeriesId = new Map<string, string>()
  const colorByKey = new Map<string, string>()
  const targetDashById = new Map<string, string | undefined>()
  let targetDashIndex = 0
  for (const item of series) {
    const key = colorKey(item)
    if (!colorByKey.has(key)) {
      colorByKey.set(
        key,
        SERIES_COLORS[colorByKey.size % SERIES_COLORS.length] ?? "var(--text-primary)",
      )
    }
    colorBySeriesId.set(item.seriesId, colorByKey.get(key) ?? "var(--text-primary)")
    if (!targetDashById.has(item.targetId)) {
      targetDashById.set(
        item.targetId,
        STROKE_DASHARRAYS[targetDashIndex % STROKE_DASHARRAYS.length],
      )
      targetDashIndex += 1
    }
  }

  const hoveredStepIdSet = new Set(hoveredStepIds)
  const hoveredItemSetIdSet = new Set(hoveredItemSetIds)
  const hasHoverSelection =
    hoveredGraphSeriesId !== null ||
    hoveredComboId !== null ||
    hoveredStepIdSet.size > 0 ||
    hoveredItemSetIdSet.size > 0

  const matchesHighlight = (item: ComboSeries): boolean => {
    if (hoveredGraphSeriesId !== null) {
      return item.seriesId === hoveredGraphSeriesId
    }
    if (hoveredStepIdSet.size > 0 && intersects(item.stepIds, hoveredStepIdSet)) {
      return true
    }
    if (hoveredItemSetIdSet.size > 0 && intersects(item.itemSetIds, hoveredItemSetIdSet)) {
      return true
    }
    if (hoveredComboId !== null) {
      return item.comboId === hoveredComboId
    }
    return true
  }

  const styleFor = (item: ComboSeries) => {
    const highlighted = matchesHighlight(item)
    if (!hasHoverSelection) {
      return { opacity: 1, emphasized: false }
    }
    if (!highlighted) {
      return { opacity: 0.25, emphasized: false }
    }
    // A hovered segment bolds itself only, never its whole line.
    return { opacity: 1, emphasized: hoveredDamage === null }
  }

  const hoverSeries = (item: ComboSeries | null) => {
    if (item === null) {
      setHoveredGraphSeries(null)
      setHoveredCombo(null)
      setHoveredSteps([])
      setHoveredStep(null)
      setHoveredItemSets([])
      setHoveredItemSet(null)
      return
    }
    setHoveredGraphSeries(item.seriesId)
    setHoveredCombo(item.comboId)
    setHoveredSteps(item.stepIds)
    setHoveredStep(item.stepIds[0] ?? null)
    setHoveredItemSets(item.itemSetIds)
    setHoveredItemSet(item.itemSetIds[0] ?? null)
  }

  const hoverStep = (stepId: string | null) => {
    setHoveredStep(stepId)
    setHoveredSteps(stepId === null ? [] : [stepId])
  }

  /** A line segment: focus its series (dimming the rest, lighting up the
   * upstream combo/item sets) and point the combo timeline at that one
   * damage chip — without marking the series' steps hovered, which would
   * enlarge every marker and light up every timeline entry. */
  const hoverDamage = (item: ComboSeries, damage: HoveredDamage | null) => {
    setHoveredDamage(damage)
    setHoveredGraphSeries(damage === null ? null : item.seriesId)
    setHoveredCombo(damage === null ? null : item.comboId)
    setHoveredItemSets(damage === null ? [] : item.itemSetIds)
  }

  const tooltipRow =
    hoveredDamage === null ? undefined : data.find((row) => row.x === hoveredDamage.x)

  return (
    <div className={styles.chartWrap}>
      <ChartLegend
        series={series}
        colorBySeriesId={colorBySeriesId}
        targetDashById={targetDashById}
        hoveredSeriesId={hoveredGraphSeriesId}
        onHoverSeries={hoverSeries}
      />
      <ResponsiveContainer width="100%" height={height}>
        <LineChart data={data} className="nodrag nowheel" margin={{ right: labelMargin }}>
          <CartesianGrid vertical={false} className={cx(styles.grid)} />
          <XAxis dataKey="xLabel" className={cx(styles.axis)} />
          <YAxis className={cx(styles.axis)} />
          <Tooltip
            content={<ChartTooltip series={series} hoveredRow={tooltipRow} />}
            // Recharts' cursor marks the *nearest* x, which mid-segment can
            // be the segment's start rather than the damage it represents.
            cursor={hoveredDamage === null}
          />
          {series.map((item, index) => (
            <ColoredLineSeries
              key={item.seriesId}
              combo={item}
              rows={data}
              dataKeySuffix={lineDataKey(chartType)}
              stroke={colorBySeriesId.get(item.seriesId) ?? "var(--text-primary)"}
              dasharray={targetDashById.get(item.targetId)}
              shape={MARKER_SHAPES[index % MARKER_SHAPES.length] ?? "circle"}
              opacity={styleFor(item).opacity}
              emphasized={styleFor(item).emphasized}
              hoveredStepId={hoveredStepId}
              hoveredStepIds={hoveredStepIds}
              hoveredDamage={hoveredDamage}
              onHoverStep={hoverStep}
              onHoverDamage={(damage) => hoverDamage(item, damage)}
            />
          ))}
        </LineChart>
      </ResponsiveContainer>
    </div>
  )
}
