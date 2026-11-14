import {
  Bar,
  BarChart,
  CartesianGrid,
  LineChart,
  ResponsiveContainer,
  Tooltip,
  XAxis,
  YAxis,
} from "recharts"
import type { ComboSeries } from "@/graph/graph-node-derivation"
import { useGraphStore } from "@/graph/store"
import type { ChartType } from "@/graph/types"
import { cx } from "@/lib/cx"
import { ChartLegend } from "./ChartLegend"
import { ChartTooltip } from "./ChartTooltip"
import { ColoredLineSeries, type MergedRow } from "./ColoredLineSeries"
import styles from "./GraphNode.module.css"
import { MARKER_SHAPES, STROKE_DASHARRAYS } from "./SeriesDot"

const CHART_HEIGHT = 260

/** One shared dataset keyed by `x` (step index, or tick-mode seconds) with
 * per-combo keys — the canonical Recharts multi-series shape, robust
 * regardless of whether combos have different step counts or (in tick
 * mode) non-aligned instance times. */
function mergeSeries(series: readonly ComboSeries[]): MergedRow[] {
  const byX = new Map<number, MergedRow>()
  for (const combo of series) {
    for (const point of combo.points) {
      const row: MergedRow = byX.get(point.x) ?? { x: point.x, xLabel: point.xLabel }
      row[`${combo.comboId}.physical`] = point.physical
      row[`${combo.comboId}.magic`] = point.magic
      row[`${combo.comboId}.true`] = point.true
      row[`${combo.comboId}.cumulative`] = point.cumulative
      row[`${combo.comboId}.targetHpAfter`] = point.targetHpAfter
      row[`${combo.comboId}.stepId`] = point.stepId ?? ""
      row[`${combo.comboId}.instances`] = point.instances
      byX.set(point.x, row)
    }
  }
  return [...byX.values()].sort((a, b) => a.x - b.x)
}

function lineDataKey(chartType: ChartType): "cumulative" | "targetHpAfter" {
  return chartType === "hp" ? "targetHpAfter" : "cumulative"
}

/** Diagonal hatch fill for magic-damage bars (DESIGN.md §6: color + a
 * redundant shape cue — "magic = fill + diagonal hatch" — used everywhere
 * a damage type is shown, including bars, not just the small chip swatch). */
function MagicHatchDefs() {
  return (
    <defs>
      <pattern
        id="magic-hatch"
        width="4"
        height="4"
        patternTransform="rotate(45)"
        patternUnits="userSpaceOnUse"
      >
        <rect width="4" height="4" className={styles.hatchBg} />
        <line x1="0" y1="0" x2="0" y2="4" className={styles.hatchLine} />
      </pattern>
    </defs>
  )
}

export function DamageChart({
  series,
  chartType,
}: {
  readonly series: readonly ComboSeries[]
  readonly chartType: ChartType
}) {
  const hoveredComboId = useGraphStore((s) => s.hoveredComboId)
  const hoveredStepId = useGraphStore((s) => s.hoveredStepId)
  const setHoveredCombo = useGraphStore((s) => s.setHoveredCombo)
  const setHoveredStep = useGraphStore((s) => s.setHoveredStep)

  if (series.length === 0) {
    return <p className={styles.emptyState}>Connect a combo to see its damage.</p>
  }

  const data = mergeSeries(series)
  const opacityFor = (comboId: string) =>
    hoveredComboId === null || hoveredComboId === comboId ? 1 : 0.25

  return (
    <div className={styles.chartWrap}>
      <ChartLegend series={series} hoveredComboId={hoveredComboId} onHover={setHoveredCombo} />
      <ResponsiveContainer width="100%" height={CHART_HEIGHT}>
        {chartType === "bars" ? (
          <BarChart data={data} className="nodrag nowheel">
            <MagicHatchDefs />
            <CartesianGrid vertical={false} className={cx(styles.grid)} />
            <XAxis dataKey="xLabel" className={cx(styles.axis)} />
            <YAxis className={cx(styles.axis)} />
            <Tooltip content={<ChartTooltip series={series} />} />
            {series.flatMap((combo) => [
              <Bar
                key={`${combo.comboId}-physical`}
                dataKey={`${combo.comboId}.physical`}
                stackId={combo.comboId}
                className={cx(styles.barPhysical)}
                style={{ opacity: opacityFor(combo.comboId) }}
                onMouseEnter={() => setHoveredCombo(combo.comboId)}
                onMouseLeave={() => setHoveredCombo(null)}
              />,
              <Bar
                key={`${combo.comboId}-magic`}
                dataKey={`${combo.comboId}.magic`}
                stackId={combo.comboId}
                className={cx(styles.barMagic)}
                style={{ opacity: opacityFor(combo.comboId) }}
                onMouseEnter={() => setHoveredCombo(combo.comboId)}
                onMouseLeave={() => setHoveredCombo(null)}
              />,
              <Bar
                key={`${combo.comboId}-true`}
                dataKey={`${combo.comboId}.true`}
                stackId={combo.comboId}
                className={cx(styles.barTrue)}
                style={{ opacity: opacityFor(combo.comboId) }}
                onMouseEnter={() => setHoveredCombo(combo.comboId)}
                onMouseLeave={() => setHoveredCombo(null)}
              />,
            ])}
          </BarChart>
        ) : (
          <LineChart data={data} className="nodrag nowheel" margin={{ right: 56 }}>
            <CartesianGrid vertical={false} className={cx(styles.grid)} />
            <XAxis dataKey="xLabel" className={cx(styles.axis)} />
            <YAxis className={cx(styles.axis)} />
            <Tooltip content={<ChartTooltip series={series} />} />
            {series.map((combo, index) => (
              <ColoredLineSeries
                key={combo.comboId}
                combo={combo}
                data={data}
                dataKeySuffix={lineDataKey(chartType)}
                dasharray={STROKE_DASHARRAYS[index % STROKE_DASHARRAYS.length]}
                shape={MARKER_SHAPES[index % MARKER_SHAPES.length] ?? "circle"}
                opacity={opacityFor(combo.comboId)}
                hoveredStepId={hoveredStepId}
                onHoverStep={setHoveredStep}
                onHoverCombo={setHoveredCombo}
              />
            ))}
          </LineChart>
        )}
      </ResponsiveContainer>
    </div>
  )
}
