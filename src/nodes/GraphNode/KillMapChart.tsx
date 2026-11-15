import { useLayoutEffect, useRef, useState } from "react"
import type { KillMapCell, KillMapData, KillOutcome } from "@/graph/resist-sweep"
import { cx } from "@/lib/cx"
import { formatSignedInt } from "./EffectiveDamageChart"
import styles from "./GraphNode.module.css"

const DEFAULT_SVG_WIDTH = 680
const PAD_LEFT = 60
const PAD_RIGHT = 16
const PAD_TOP = 12
const PAD_BOTTOM = 38
const RESIST_TICK_STEP = 50
/** Smallest round HP step that keeps the axis at six labels or fewer. */
function hpTickStep(maxHp: number): number {
  return [250, 500, 1000, 2000, 5000].find((step) => maxHp / step <= 6) ?? 10000
}

function outcomeFill(outcome: KillOutcome): string {
  switch (outcome) {
    case "onlyA":
      return "var(--killmap-only-a)"
    case "onlyB":
      return "var(--killmap-only-b)"
    case "both":
      return "var(--killmap-both)"
    case "neither":
      return "var(--killmap-neither)"
  }
}

function clamp(value: number, min: number, max: number): number {
  return Math.min(max, Math.max(min, value))
}

function buildTicks(min: number, max: number, step: number): number[] {
  const first = Math.ceil(min / step) * step
  const ticks: number[] = []
  for (let value = first; value <= max; value += step) {
    ticks.push(value)
  }
  return ticks
}

/**
 * Hand-rolled responsive SVG heatmap ("Graph: Effective Damage" → Kill map)
 * plotting HP × resistance kill outcomes for two combo variants (A vs B),
 * with reference target marker, cell hover tooltip, categorical legend, and
 * bonus-resistance share caption.
 */
export function KillMapChart({
  data,
  labelA,
  labelB,
  height,
}: {
  readonly data: KillMapData
  readonly labelA: string
  readonly labelB: string
  readonly height: number
}) {
  const stageRef = useRef<HTMLDivElement>(null)
  const [svgWidth, setSvgWidth] = useState<number>(DEFAULT_SVG_WIDTH)
  const [hoveredCell, setHoveredCell] = useState<KillMapCell | null>(null)

  useLayoutEffect(() => {
    const el = stageRef.current
    if (el === null) {
      return
    }
    const updateWidth = () => {
      if (el.clientWidth > 0) {
        setSvgWidth(el.clientWidth)
      }
    }
    updateWidth()
    const observer = new ResizeObserver(updateWidth)
    observer.observe(el)
    return () => observer.disconnect()
  }, [])

  const { resists, hps, cells, markers } = data
  const colCount = Math.max(1, resists.length)
  const rowCount = Math.max(1, hps.length)
  const plotWidth = Math.max(1, svgWidth - PAD_LEFT - PAD_RIGHT)
  const plotHeight = Math.max(1, height - PAD_TOP - PAD_BOTTOM)
  const cellW = plotWidth / colCount
  const cellH = plotHeight / rowCount

  const minResist = resists[0] ?? 0
  const maxResist = resists[resists.length - 1] ?? 400
  const minHp = hps[0] ?? 500
  const maxHp = hps[hps.length - 1] ?? 6000
  const resistSpan = Math.max(1, maxResist - minResist)
  const hpSpan = Math.max(1, maxHp - minHp)

  const xForResist = (resist: number): number =>
    PAD_LEFT +
    clamp((resist - minResist) / resistSpan, 0, 1) * Math.max(0, plotWidth - cellW) +
    cellW / 2

  const yForHp = (hp: number): number =>
    PAD_TOP + clamp((maxHp - hp) / hpSpan, 0, 1) * Math.max(0, plotHeight - cellH) + cellH / 2

  const resistTicks = buildTicks(minResist, maxResist, RESIST_TICK_STEP)
  const hpTicks = buildTicks(minHp, maxHp, hpTickStep(maxHp))
  const axisTitle = data.axis === "magicResist" ? "Magic Resist" : "Armor"
  const bonusAxisWord = data.axis === "magicResist" ? "magic resist" : "armor"

  const legendItems = [
    { key: "onlyA", label: `Only ${labelA} kills`, fill: "var(--killmap-only-a)" },
    { key: "onlyB", label: `Only ${labelB} kills`, fill: "var(--killmap-only-b)" },
    { key: "both", label: "Both kill", fill: "var(--killmap-both)" },
    { key: "neither", label: "Neither", fill: "var(--killmap-neither)" },
  ] as const

  return (
    <div className={cx(styles.chartWrap, "nodrag", "nowheel")}>
      <ul className={styles.killMapLegend} style={{ paddingLeft: PAD_LEFT }}>
        {legendItems.map((item) => (
          <li key={item.key} className={styles.killMapLegendItem}>
            <span className={styles.killMapSwatch} style={{ backgroundColor: item.fill }} />
            <span>{item.label}</span>
          </li>
        ))}
      </ul>

      <div ref={stageRef} className={styles.killMapStage}>
        <svg
          width="100%"
          height={height}
          viewBox={`0 0 ${svgWidth} ${height}`}
          role="img"
          aria-label={`Kill map comparing ${labelA} and ${labelB}`}
          className={styles.killMapSvg}
        >
          <g>
            {hps.map((hp, hpIndex) => {
              const rowFromTop = rowCount - 1 - hpIndex
              const y = PAD_TOP + rowFromTop * cellH
              return resists.map((resist, resistIndex) => {
                const cell = cells[hpIndex * resists.length + resistIndex]
                if (cell === undefined) {
                  return null
                }
                const x = PAD_LEFT + resistIndex * cellW
                const isHovered = hoveredCell?.resist === cell.resist && hoveredCell?.hp === cell.hp
                return (
                  // biome-ignore lint/a11y/noStaticElementInteractions: SVG heatmap cell updates hover readout tooltip
                  <rect
                    key={`${hp}-${resist}`}
                    x={x}
                    y={y}
                    width={cellW}
                    height={cellH}
                    fill={outcomeFill(cell.outcome)}
                    className={cx(styles.killMapCell, isHovered && styles.killMapCellHovered)}
                    data-resist={cell.resist}
                    data-hp={cell.hp}
                    data-outcome={cell.outcome}
                    onMouseEnter={() => setHoveredCell(cell)}
                    onMouseLeave={() => setHoveredCell(null)}
                  />
                )
              })
            })}
          </g>

          {hpTicks.map((hp) => {
            const y = yForHp(hp)
            return (
              <g key={`hp-${hp}`} transform={`translate(0,${y})`}>
                <line x1={PAD_LEFT - 4} x2={PAD_LEFT} y1={0} y2={0} className={styles.grid} />
                <text
                  x={PAD_LEFT - 8}
                  y={0}
                  dy={4}
                  textAnchor="end"
                  className={cx(styles.axis, "num")}
                >
                  {hp}
                </text>
              </g>
            )
          })}

          {resistTicks.map((resist) => {
            const x = xForResist(resist)
            const bottomY = PAD_TOP + plotHeight
            return (
              <g key={`resist-${resist}`} transform={`translate(${x},${bottomY})`}>
                <line x1={0} x2={0} y1={0} y2={4} className={styles.grid} />
                <text x={0} y={16} textAnchor="middle" className={cx(styles.axis, "num")}>
                  {resist}
                </text>
              </g>
            )
          })}

          <text
            x={PAD_LEFT + plotWidth / 2}
            y={height - 4}
            textAnchor="middle"
            className={styles.axis}
          >
            {axisTitle}
          </text>
          <text
            transform={`translate(14,${PAD_TOP + plotHeight / 2}) rotate(-90)`}
            textAnchor="middle"
            className={styles.axis}
          >
            HP
          </text>

          {markers.map((marker) => {
            const markerX = xForResist(marker.resist)
            const markerY = yForHp(marker.hp)
            const markerAlignEnd = markerX > PAD_LEFT + plotWidth * 0.75
            return (
              <g
                key={marker.id}
                transform={`translate(${markerX},${markerY})`}
                className={styles.killMapMarker}
                data-target-id={marker.id}
              >
                <circle r={6} className={styles.killMapMarkerHalo} />
                <circle r={4.5} className={styles.killMapMarkerRing} />
                <text
                  x={markerAlignEnd ? -9 : 9}
                  y={4}
                  textAnchor={markerAlignEnd ? "end" : "start"}
                  className={styles.killMapMarkerLabel}
                >
                  {marker.name}
                </text>
              </g>
            )
          })}
        </svg>

        {hoveredCell === null ? null : (
          <div
            role="tooltip"
            className={cx(
              styles.tooltip,
              styles.killMapTooltip,
              hoveredCell.resist > maxResist * 0.5 && styles.killMapTooltipLeft,
            )}
          >
            <div className={styles.tooltipLabel}>
              HP {hoveredCell.hp.toLocaleString()} · {axisTitle} {hoveredCell.resist}
            </div>
            <div className={styles.tooltipRow}>
              <span>{labelA}</span>
              <span className="num">{Math.round(hoveredCell.damageA).toLocaleString()}</span>
            </div>
            <div className={styles.tooltipRow}>
              <span>{labelB}</span>
              <span className="num">{Math.round(hoveredCell.damageB).toLocaleString()}</span>
            </div>
            <div className={styles.tooltipRow}>
              <span>Δ (B−A)</span>
              <span className="num">
                {formatSignedInt(Math.round(hoveredCell.damageB) - Math.round(hoveredCell.damageA))}
              </span>
            </div>
          </div>
        )}
      </div>

      <p className={styles.killMapCaption}>
        Bonus {bonusAxisWord} share: {Math.round(data.bonusShare * 100)}% (from target{" "}
        {data.referenceName})
      </p>
    </div>
  )
}
