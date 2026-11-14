import type { ComboSeries } from "@/graph/graph-node-derivation"
import styles from "./GraphNode.module.css"
import { MARKER_SHAPES } from "./SeriesDot"

function LegendSwatch({
  dasharray,
  shape,
  stroke,
}: {
  readonly dasharray: string | undefined
  readonly shape: (typeof MARKER_SHAPES)[number]
  readonly stroke: string
}) {
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
        stroke={stroke}
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
 * styling") — one entry per combo × item-set variant × target, showing the
 * same stroke-pattern × marker-shape encoding as the plot, doubling as the
 * hover trigger for the upstream-highlight feature (plan D11). */
export function ChartLegend({
  series,
  colorBySeriesId,
  targetDashById,
  hoveredSeriesId,
  onHoverSeries,
}: {
  readonly series: readonly ComboSeries[]
  readonly colorBySeriesId: ReadonlyMap<string, string>
  readonly targetDashById: ReadonlyMap<string, string | undefined>
  readonly hoveredSeriesId: string | null
  readonly onHoverSeries: (series: ComboSeries | null) => void
}) {
  return (
    <ul className={styles.legend}>
      {series.map((combo, index) => (
        <li key={combo.seriesId}>
          <button
            type="button"
            className={styles.legendItem}
            data-dimmed={
              hoveredSeriesId !== null && hoveredSeriesId !== combo.seriesId ? "true" : undefined
            }
            onMouseEnter={() => onHoverSeries(combo)}
            onMouseLeave={() => onHoverSeries(null)}
          >
            <LegendSwatch
              dasharray={targetDashById.get(combo.targetId)}
              shape={MARKER_SHAPES[index % MARKER_SHAPES.length] ?? "circle"}
              stroke={colorBySeriesId.get(combo.seriesId) ?? "var(--text-primary)"}
            />
            <span>{combo.comboName}</span>
            <span className={styles.legendMeta}>
              {combo.variantName === "" ? "" : `${combo.variantName} · `}vs {combo.targetName}
            </span>
          </button>
        </li>
      ))}
    </ul>
  )
}
