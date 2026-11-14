import type { ComboSeries } from "@/graph/graph-node-derivation"
import styles from "./GraphNode.module.css"
import { MARKER_SHAPES, STROKE_DASHARRAYS } from "./SeriesDot"

function LegendSwatch({ index }: { readonly index: number }) {
  const dasharray = STROKE_DASHARRAYS[index % STROKE_DASHARRAYS.length]
  const shape = MARKER_SHAPES[index % MARKER_SHAPES.length] ?? "circle"
  return (
    <svg
      width="24"
      height="12"
      viewBox="0 0 24 12"
      className={styles.legendSwatch}
      aria-hidden="true"
    >
      <line
        x1="0"
        y1="6"
        x2="24"
        y2="6"
        strokeDasharray={dasharray}
        className={styles.legendLine}
      />
      {shape === "square" ? (
        <rect x="9" y="3" width="6" height="6" className={styles.legendMarker} />
      ) : shape === "diamond" ? (
        <polygon points="12,2 16,6 12,10 8,6" className={styles.legendMarker} />
      ) : (
        <circle cx="12" cy="6" r="3" className={styles.legendMarker} />
      )}
    </svg>
  )
}

/** Custom legend (DESIGN.md §7: "No default React Flow or Recharts
 * styling") — one entry per combo, showing the same stroke-pattern ×
 * marker-shape encoding as the plot, doubling as the hover trigger for the
 * upstream-highlight feature (plan D11). */
export function ChartLegend({
  series,
  hoveredComboId,
  onHover,
}: {
  readonly series: readonly ComboSeries[]
  readonly hoveredComboId: string | null
  readonly onHover: (comboId: string | null) => void
}) {
  return (
    <ul className={styles.legend}>
      {series.map((combo, index) => (
        <li key={combo.comboId}>
          <button
            type="button"
            className={styles.legendItem}
            data-dimmed={
              hoveredComboId !== null && hoveredComboId !== combo.comboId ? "true" : undefined
            }
            onMouseEnter={() => onHover(combo.comboId)}
            onMouseLeave={() => onHover(null)}
          >
            <LegendSwatch index={index} />
            <span>{combo.comboName}</span>
          </button>
        </li>
      ))}
    </ul>
  )
}
