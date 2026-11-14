import { Bar, BarChart, CartesianGrid, Line, LineChart, Tooltip, XAxis, YAxis } from "recharts"
import type { ComboSeries } from "@/graph/graph-node-derivation"
import { useGraphStore } from "@/graph/store"
import type { ChartType } from "@/graph/types"
import { cx } from "@/lib/cx"
import { ChartLegend } from "./ChartLegend"
import { ChartTooltip } from "./ChartTooltip"
import styles from "./GraphNode.module.css"
import { MARKER_SHAPES, SeriesDot, STROKE_DASHARRAYS } from "./SeriesDot"

type MergedRow = { readonly x: number; readonly xLabel: string } & Record<string, number | string>

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
      byX.set(point.x, row)
    }
  }
  return [...byX.values()].sort((a, b) => a.x - b.x)
}

function lineDataKey(chartType: ChartType): "cumulative" | "targetHpAfter" {
  return chartType === "hp" ? "targetHpAfter" : "cumulative"
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
      {chartType === "bars" ? (
        <BarChart width={560} height={240} data={data} className="nodrag nowheel">
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
        <LineChart width={560} height={240} data={data} className="nodrag nowheel">
          <CartesianGrid vertical={false} className={cx(styles.grid)} />
          <XAxis dataKey="xLabel" className={cx(styles.axis)} />
          <YAxis className={cx(styles.axis)} />
          <Tooltip content={<ChartTooltip series={series} />} />
          {series.map((combo, index) => {
            const shape = MARKER_SHAPES[index % MARKER_SHAPES.length] ?? "circle"
            const dasharray = STROKE_DASHARRAYS[index % STROKE_DASHARRAYS.length]
            return (
              <Line
                key={combo.comboId}
                type="monotone"
                dataKey={`${combo.comboId}.${lineDataKey(chartType)}`}
                name={combo.comboName}
                className={cx(styles.line)}
                {...(dasharray === undefined ? {} : { strokeDasharray: dasharray })}
                strokeOpacity={opacityFor(combo.comboId)}
                connectNulls
                dot={(dotProps) => {
                  const rowIndex = dotProps.index ?? -1
                  const stepId = data[rowIndex]?.[`${combo.comboId}.stepId`]
                  return (
                    <SeriesDot
                      key={`${combo.comboId}-${String(dotProps.index ?? dotProps.key)}`}
                      cx={dotProps.cx}
                      cy={dotProps.cy}
                      shape={shape}
                      opacity={opacityFor(combo.comboId)}
                      highlighted={hoveredStepId !== null && stepId === hoveredStepId}
                      stepId={typeof stepId === "string" && stepId !== "" ? stepId : undefined}
                      onHover={setHoveredStep}
                      className={cx(styles.markerFill)}
                    />
                  )
                }}
                activeDot={{ r: 5 }}
                onMouseEnter={() => setHoveredCombo(combo.comboId)}
                onMouseLeave={() => setHoveredCombo(null)}
              />
            )
          })}
        </LineChart>
      )}
    </div>
  )
}
