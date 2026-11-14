import type { ComboSeries } from "@/graph/graph-node-derivation"
import styles from "./GraphNode.module.css"

type TooltipPayloadEntry = { readonly payload?: Record<string, unknown> }

function readNumber(row: Record<string, unknown>, key: string): number {
  const value = row[key]
  return typeof value === "number" ? value : 0
}

/** Custom tooltip (DESIGN.md §7/§9: no default Recharts tooltip). Shows
 * every connected combo's total at the hovered point, read straight off the
 * merged data row rather than reassembling it from Recharts' own
 * per-dataKey payload entries. */
export function ChartTooltip(props: {
  readonly active?: boolean
  readonly label?: string
  readonly payload?: readonly TooltipPayloadEntry[]
  readonly series: readonly ComboSeries[]
}) {
  const { active, label, payload, series } = props
  if (active !== true || payload === undefined || payload.length === 0) {
    return null
  }
  const row = payload[0]?.payload
  if (row === undefined) {
    return null
  }

  return (
    <div className={styles.tooltip}>
      <div className={styles.tooltipLabel}>{label}</div>
      {series.map((combo) => {
        const total =
          readNumber(row, `${combo.comboId}.physical`) +
          readNumber(row, `${combo.comboId}.magic`) +
          readNumber(row, `${combo.comboId}.true`)
        return (
          <div key={combo.comboId} className={styles.tooltipRow}>
            <span>{combo.comboName}</span>
            <span className="num">{Math.round(total).toLocaleString()}</span>
          </div>
        )
      })}
    </div>
  )
}
