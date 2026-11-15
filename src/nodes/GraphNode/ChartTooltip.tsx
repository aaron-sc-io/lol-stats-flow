import { DamageTypeChip } from "@/components/DamageTypeChip"
import type { DamageInstance } from "@/engine"
import { type ComboSeries, seriesLabel } from "@/graph/graph-node-derivation"
import type { MergedRow } from "./ColoredLineSeries"
import styles from "./GraphNode.module.css"

type TooltipPayloadEntry = { readonly payload?: Record<string, unknown> }

function readInstances(row: Record<string, unknown>, key: string): readonly DamageInstance[] {
  const value = row[key]
  return Array.isArray(value) ? (value as DamageInstance[]) : []
}

export function ChartBreakdownCard({
  label,
  row,
  series,
  pinnedSeriesId,
}: {
  readonly label: string | undefined
  readonly row: Record<string, unknown>
  readonly series: readonly ComboSeries[]
  readonly pinnedSeriesId?: string | null | undefined
}) {
  return (
    <div className={styles.tooltip}>
      <div className={styles.tooltipLabel}>
        {label}
        {pinnedSeriesId !== undefined && pinnedSeriesId !== null ? (
          <span className={styles.pinnedBadge}>Pinned</span>
        ) : null}
      </div>
      {series.map((combo) => {
        const instances = readInstances(row, `${combo.seriesId}.instances`)
        if (instances.length === 0) {
          return null
        }
        const total = instances.reduce((sum, instance) => sum + instance.mitigated, 0)
        return (
          <div key={combo.seriesId} className={styles.tooltipCombo}>
            <div className={styles.tooltipRow}>
              <span>
                {seriesLabel(combo)} · {combo.targetName}
              </span>
              <span className="num">{Math.round(total).toLocaleString()}</span>
            </div>
            <ul className={styles.tooltipInstances}>
              {instances.map((instance, index) => (
                <li
                  // biome-ignore lint/suspicious/noArrayIndexKey: a point's instance list is rebuilt fresh from derived SimResult data every render, never reordered in place
                  key={index}
                  className={styles.tooltipInstance}
                >
                  <DamageTypeChip type={instance.damageType}>
                    {Math.round(instance.raw).toLocaleString()} →{" "}
                    {Math.round(instance.mitigated).toLocaleString()}
                  </DamageTypeChip>
                  <span className={styles.tooltipInstanceMeta}>
                    {instance.label} · HP {Math.round(instance.targetHpAfter).toLocaleString()}
                  </span>
                </li>
              ))}
            </ul>
          </div>
        )
      })}
    </div>
  )
}

/** Custom tooltip (DESIGN.md §6/§7/§9: no default Recharts tooltip) showing
 * single-line damage adjustments when hovering a specific line segment or when
 * a line is pinned as the priority hover target. (The all-lines step breakdown
 * lives on the X-axis step icon tick hover.) */
export function ChartTooltip(props: {
  readonly active?: boolean
  readonly label?: string
  readonly payload?: readonly TooltipPayloadEntry[]
  readonly series: readonly ComboSeries[]
  /** The row of the hovered line segment, if any — it wins over Recharts'
   * nearest-x row, which mid-segment can be the segment's *start* point
   * rather than the damage the segment represents. */
  readonly hoveredRow?: MergedRow | undefined
  /** Active single-series target (pinned series if pinned, otherwise the
   * hovered segment's series). When null, line tooltip stays hidden so only
   * step icon ticks show the multi-series breakdown. */
  readonly targetSeriesId?: string | null | undefined
  readonly pinnedSeriesId?: string | null | undefined
}) {
  const { active, payload, series, hoveredRow, targetSeriesId, pinnedSeriesId } = props
  if (active !== true || payload === undefined || payload.length === 0) {
    return null
  }
  if (targetSeriesId === undefined || targetSeriesId === null) {
    return null
  }
  const row: Record<string, unknown> | undefined = hoveredRow ?? payload[0]?.payload
  if (row === undefined) {
    return null
  }
  const filteredSeries = series.filter((combo) => combo.seriesId === targetSeriesId)
  // The zero-damage origin (or a row where the target series has no instances) has nothing to break down.
  if (
    filteredSeries.every((combo) => readInstances(row, `${combo.seriesId}.instances`).length === 0)
  ) {
    return null
  }
  const label = hoveredRow?.xLabel ?? props.label

  return (
    <ChartBreakdownCard
      label={label}
      row={row}
      series={filteredSeries}
      pinnedSeriesId={pinnedSeriesId}
    />
  )
}
