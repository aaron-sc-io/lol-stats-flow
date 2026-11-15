import { useState } from "react"
import {
  CartesianGrid,
  Line,
  LineChart,
  ReferenceLine,
  ResponsiveContainer,
  Tooltip,
  XAxis,
  YAxis,
} from "recharts"
import { type ComboSeries, seriesLabel } from "@/graph/graph-node-derivation"
import { RESIST_SWEEP_MAX, RESIST_SWEEP_STEP } from "@/graph/resist-sweep"
import type { ResistAxis, SeriesOverride } from "@/graph/types"
import { cx } from "@/lib/cx"
import { ChartLegend, dashStyleToDasharray } from "./ChartLegend"
import styles from "./GraphNode.module.css"
import { STROKE_DASHARRAYS } from "./SeriesDot"

export const DEFAULT_CURSOR_RESIST = 100
const Y_AXIS_WIDTH = 60
const SERIES_COLORS = [
  "var(--text-primary)",
  "var(--dmg-magic)",
  "var(--dmg-physical)",
  "var(--text-secondary)",
] as const

const X_TICKS = Array.from({ length: RESIST_SWEEP_MAX / 50 + 1 }, (_, index) => index * 50)

type Row = { readonly x: number } & Record<string, number>

function percentOfTargetHp(total: number, targetHp: number): number {
  return targetHp > 0 ? (total / targetHp) * 100 : 0
}

export function formatSignedInt(value: number): string {
  const rounded = Math.round(value)
  return rounded > 0 ? `+${rounded.toLocaleString()}` : rounded.toLocaleString()
}

function resistAxisLabel(axis: ResistAxis): string {
  return axis === "magicResist" ? "Magic Resist" : "Armor"
}

function mergeRows(series: readonly ComboSeries[]): Row[] {
  const rows: Row[] = []
  for (let x = 0; x <= RESIST_SWEEP_MAX; x += RESIST_SWEEP_STEP) {
    const row: Record<string, number> = { x }
    for (const item of series) {
      const point = item.points.find((candidate) => candidate.x === x)
      if (point !== undefined) {
        row[item.seriesId] = percentOfTargetHp(point.total, item.targetHp)
      }
    }
    rows.push(row as Row)
  }
  return rows
}

function EffectiveTooltip({
  active,
  label,
  payload,
  series,
  axisLabel,
}: {
  readonly active?: boolean
  readonly label?: string | number
  readonly payload?: ReadonlyArray<{ readonly dataKey?: unknown; readonly value?: unknown }>
  readonly series: readonly ComboSeries[]
  readonly axisLabel: string
}) {
  if (active !== true || payload === undefined || payload.length === 0) {
    return null
  }
  const resistX = Number(label)
  return (
    <div className={styles.tooltip}>
      <div className={styles.tooltipLabel}>
        {label} {axisLabel}
      </div>
      {payload.map((entry) => {
        const item = series.find((candidate) => candidate.seriesId === entry.dataKey)
        if (item === undefined || typeof entry.value !== "number") {
          return null
        }
        const point = item.points.find((candidate) => candidate.x === resistX)
        const dmg = Math.round(point?.total ?? 0).toLocaleString()
        return (
          <div key={item.seriesId} className={styles.tooltipRow}>
            <span>
              {seriesLabel(item)} · {item.targetName}
            </span>
            <span className="num">
              {dmg} ({entry.value.toFixed(1)}%)
            </span>
          </div>
        )
      })}
    </div>
  )
}

/** "Graph: Effective Damage" curves view: each combo × item-set variant ×
 * target's uncapped damage as % of target HP across 0–400 Armor or MR, with
 * a 100% Kill line and a live local resist cursor + readout table. */
export function EffectiveDamageChart({
  graphNodeId,
  series,
  resistAxis = "armor",
  seriesOverrides,
  height,
  cursorResist,
  onCursorResistChange,
}: {
  readonly graphNodeId: string
  readonly series: readonly ComboSeries[]
  readonly resistAxis?: ResistAxis | undefined
  readonly seriesOverrides?: Readonly<Record<string, SeriesOverride>> | undefined
  readonly height: number
  readonly cursorResist: number
  readonly onCursorResistChange: (resist: number) => void
}) {
  const [hoveredSeriesId, setHoveredSeriesId] = useState<string | null>(null)
  const [pinnedSeriesId, setPinnedSeriesId] = useState<string | null>(null)

  if (series.length === 0) {
    return <p className={styles.emptyState}>Connect a combo to see its damage.</p>
  }

  const axisLabel = resistAxisLabel(resistAxis)
  const visibleSeries = series.filter((item) => seriesOverrides?.[item.seriesId]?.hidden !== true)
  const rows = mergeRows(visibleSeries)
  // Even 25%/50% ticks that always include the 100% kill line.
  const maxPercent = Math.max(
    100,
    ...rows.flatMap((row) =>
      Object.entries(row)
        .filter(([k]) => k !== "x")
        .map(([, v]) => v),
    ),
  )
  const yStep = maxPercent > 200 ? 50 : 25
  const yMax = Math.ceil(maxPercent / yStep) * yStep
  const yTicks = Array.from({ length: yMax / yStep + 1 }, (_, index) => index * yStep)
  const colorBySeriesId = new Map<string, string>()
  const colorByKey = new Map<string, string>()
  const targetDashById = new Map<string, string | undefined>()
  for (const item of series) {
    const key = `${item.comboId}__${item.variantId}`
    if (!colorByKey.has(key)) {
      colorByKey.set(key, SERIES_COLORS[colorByKey.size % SERIES_COLORS.length] ?? "")
    }
    colorBySeriesId.set(item.seriesId, colorByKey.get(key) ?? "var(--text-primary)")
    if (!targetDashById.has(item.targetId)) {
      targetDashById.set(
        item.targetId,
        STROKE_DASHARRAYS[targetDashById.size % STROKE_DASHARRAYS.length],
      )
    }
  }
  const focusedSeriesId = pinnedSeriesId ?? hoveredSeriesId

  return (
    <div className={styles.chartWrap}>
      <div style={{ paddingLeft: Y_AXIS_WIDTH, minWidth: 0 }}>
        <ChartLegend
          graphNodeId={graphNodeId}
          series={series}
          colorBySeriesId={colorBySeriesId}
          targetDashById={targetDashById}
          seriesOverrides={seriesOverrides}
          hoveredSeriesId={focusedSeriesId}
          pinnedSeriesId={pinnedSeriesId}
          onHoverSeries={(item) => setHoveredSeriesId(item?.seriesId ?? null)}
          onTogglePinSeries={(seriesId) =>
            setPinnedSeriesId((current) => (current === seriesId ? null : seriesId))
          }
        />
      </div>
      <ResponsiveContainer width="100%" height={height}>
        <LineChart data={rows} className="nodrag nowheel" margin={{ right: 16 }}>
          <CartesianGrid vertical={false} className={cx(styles.grid)} />
          <XAxis
            dataKey="x"
            type="number"
            domain={[0, RESIST_SWEEP_MAX]}
            ticks={X_TICKS}
            className={cx(styles.axis)}
            label={{ value: axisLabel, position: "insideBottom", offset: -2 }}
            height={36}
          />
          <YAxis
            width={Y_AXIS_WIDTH}
            domain={[0, yMax]}
            ticks={yTicks}
            tickFormatter={(value: number) => `${Math.round(value)}%`}
            className={cx(styles.axis)}
          />
          <ReferenceLine
            y={100}
            stroke="var(--border-strong)"
            strokeDasharray="4 4"
            ifOverflow="extendDomain"
            label={{
              value: "Kill",
              position: "insideTopRight",
              className: styles.referenceLabel ?? "",
            }}
          />
          <ReferenceLine x={cursorResist} stroke="var(--text-secondary)" strokeDasharray="2 2" />
          <Tooltip content={<EffectiveTooltip series={visibleSeries} axisLabel={axisLabel} />} />
          {visibleSeries.map((item) => {
            const override = seriesOverrides?.[item.seriesId]
            const dasharray =
              override?.dashStyle !== undefined
                ? dashStyleToDasharray(override.dashStyle)
                : targetDashById.get(item.targetId)
            const dimmed = focusedSeriesId !== null && focusedSeriesId !== item.seriesId
            return (
              <Line
                key={item.seriesId}
                type="monotone"
                dataKey={item.seriesId}
                name={seriesLabel(item)}
                stroke={
                  override?.color ?? colorBySeriesId.get(item.seriesId) ?? "var(--text-primary)"
                }
                strokeWidth={
                  (override?.strokeWidth ?? 1.5) + (focusedSeriesId === item.seriesId ? 1 : 0)
                }
                strokeOpacity={dimmed ? 0.25 : 1}
                {...(dasharray === undefined ? {} : { strokeDasharray: dasharray })}
                dot={false}
                isAnimationActive={false}
                legendType="none"
              />
            )
          })}
        </LineChart>
      </ResponsiveContainer>
      <div className={cx(styles.cursorSection, "nodrag", "nowheel")}>
        <div className={styles.cursorHeader}>
          <span className={styles.cursorLabel}>
            Cursor {axisLabel}: <span className="num">{cursorResist}</span>
          </span>
          <input
            type="range"
            min={0}
            max={RESIST_SWEEP_MAX}
            step={RESIST_SWEEP_STEP}
            value={cursorResist}
            aria-label={`Cursor ${axisLabel}`}
            className={styles.cursorRange}
            onChange={(event) => onCursorResistChange(Number(event.target.value))}
          />
        </div>
      </div>
    </div>
  )
}

/** The curves view's cursor readout table. Rendered in the GraphNode's
 * scrolling table region (not under the chart) so a height-resized node
 * scrolls/clips the rows instead of overflowing the frame. */
export function EffectiveReadoutTable({
  series,
  seriesOverrides,
  cursorResist,
}: {
  readonly series: readonly ComboSeries[]
  readonly seriesOverrides?: Readonly<Record<string, SeriesOverride>> | undefined
  readonly cursorResist: number
}) {
  const visibleSeries = series.filter((item) => seriesOverrides?.[item.seriesId]?.hidden !== true)
  if (visibleSeries.length === 0) {
    return null
  }
  const firstPoint = visibleSeries[0]?.points.find((candidate) => candidate.x === cursorResist)
  const firstDamage = Math.round(firstPoint?.total ?? 0)
  return (
    <table className={styles.table}>
      <thead>
        <tr>
          <th>Series</th>
          <th className={styles.numHeader}>Damage</th>
          <th className={styles.numHeader}>% HP</th>
          <th className={styles.numHeader}>Margin</th>
          <th className={styles.numHeader}>Kill</th>
          <th className={styles.numHeader}>Δ vs first</th>
        </tr>
      </thead>
      <tbody>
        {visibleSeries.map((item) => {
          const point = item.points.find((candidate) => candidate.x === cursorResist)
          const rawDamage = point?.total ?? 0
          const damage = Math.round(rawDamage)
          const percentHp = percentOfTargetHp(rawDamage, item.targetHp)
          const margin = damage - Math.round(item.targetHp)
          const killed = rawDamage >= item.targetHp
          const delta = damage - firstDamage
          return (
            <tr key={item.seriesId}>
              <td>
                {seriesLabel(item)} · {item.targetName}
              </td>
              <td className="num">{damage.toLocaleString()}</td>
              <td className="num">{percentHp.toFixed(1)}%</td>
              <td className="num">{formatSignedInt(margin)}</td>
              <td className="num">{killed ? "✓" : "✗"}</td>
              <td className="num">{formatSignedInt(delta)}</td>
            </tr>
          )
        })}
      </tbody>
    </table>
  )
}
