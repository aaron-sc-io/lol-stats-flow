import type { ReactElement } from "react"
import { Line, useXAxisScale, useYAxisScale } from "recharts"
import type { DamageInstance, DamageType } from "@/engine"
import { type ChartPoint, dominantDamageType } from "@/graph/chart-points"
import type { ComboSeries } from "@/graph/graph-node-derivation"
import { cx } from "@/lib/cx"
import styles from "./GraphNode.module.css"
import type { MarkerShape } from "./SeriesDot"
import { SeriesDot } from "./SeriesDot"

export type MergedRow = { readonly x: number; readonly xLabel: string } & Record<
  string,
  number | string | readonly DamageInstance[]
>

const DAMAGE_STROKE: Record<DamageType, string> = {
  physical: "var(--dmg-physical)",
  magic: "var(--dmg-magic)",
  true: "var(--dmg-true)",
}

function readPointValue(point: ChartPoint, dataKeySuffix: "cumulative" | "targetHpAfter"): number {
  return dataKeySuffix === "cumulative" ? point.cumulative : point.targetHpAfter
}

/** The colored multi-segment stroke itself (DESIGN.md §6: "each segment
 * takes the color of the damage type dealt in that step/tick"). Recharts
 * has no native per-segment line coloring, and giving each segment its own
 * partial `<Line data={...}>` override (the usual workaround) corrupts the
 * shared category axis domain for a multi-combo chart — every segment's
 * own 2-point slice gets unioned into the tick set, duplicating labels and
 * desyncing the scale from the real (full-dataset) one every other series
 * element uses. Drawing plain `<line>`s with the chart's OWN axis scale
 * (`useXAxisScale`/`useYAxisScale`, rendered as a plain child inside the
 * chart context) avoids all of that — the axis is computed exactly once,
 * from the real shared dataset, same as for every other element. */
function ColoredSegments({
  combo,
  dataKeySuffix,
  dasharray,
  opacity,
}: {
  readonly combo: ComboSeries
  readonly dataKeySuffix: "cumulative" | "targetHpAfter"
  readonly dasharray: string | undefined
  readonly opacity: number
}) {
  const xScale = useXAxisScale()
  const yScale = useYAxisScale()
  if (xScale === undefined || yScale === undefined) {
    return null
  }

  const segments: ReactElement[] = []
  for (let index = 0; index < combo.points.length - 1; index += 1) {
    const from = combo.points[index]
    const to = combo.points[index + 1]
    if (from === undefined || to === undefined) {
      continue
    }
    const x1 = xScale(from.xLabel, { position: "middle" })
    const y1 = yScale(readPointValue(from, dataKeySuffix))
    const x2 = xScale(to.xLabel, { position: "middle" })
    const y2 = yScale(readPointValue(to, dataKeySuffix))
    if (x1 === undefined || y1 === undefined || x2 === undefined || y2 === undefined) {
      continue
    }
    segments.push(
      <line
        key={`${combo.comboId}-segment-${index}`}
        x1={x1}
        y1={y1}
        x2={x2}
        y2={y2}
        stroke={DAMAGE_STROKE[dominantDamageType(to)]}
        strokeWidth={1.5}
        strokeOpacity={opacity}
        {...(dasharray === undefined ? {} : { strokeDasharray: dasharray })}
      />,
    )
  }
  return <g className={cx("nodrag", "nowheel")}>{segments}</g>
}

/**
 * One combo's full line presentation: the colored segments above, plus one
 * invisible-stroke "marker" `<Line>` (driven off the shared chart dataset,
 * same as every other series — this one is safe to keep as a real Line)
 * carrying the real dot/highlight renderer and a direct end-of-line name
 * label (DESIGN.md §6: combo series get "a direct label at the end of the
 * line").
 */
export function ColoredLineSeries({
  combo,
  data,
  dataKeySuffix,
  dasharray,
  shape,
  opacity,
  hoveredStepId,
  onHoverStep,
  onHoverCombo,
}: {
  readonly combo: ComboSeries
  readonly data: readonly MergedRow[]
  readonly dataKeySuffix: "cumulative" | "targetHpAfter"
  readonly dasharray: string | undefined
  readonly shape: MarkerShape
  readonly opacity: number
  readonly hoveredStepId: string | null
  readonly onHoverStep: (stepId: string | null) => void
  readonly onHoverCombo: (comboId: string | null) => void
}) {
  const valueKey = `${combo.comboId}.${dataKeySuffix}`
  const stepKey = `${combo.comboId}.stepId`
  const lastIndex = data.length - 1

  const handlers = {
    onMouseEnter: () => onHoverCombo(combo.comboId),
    onMouseLeave: () => onHoverCombo(null),
  }

  return (
    <>
      <ColoredSegments
        combo={combo}
        dataKeySuffix={dataKeySuffix}
        dasharray={dasharray}
        opacity={opacity}
      />
      <Line
        type="monotone"
        data={data}
        dataKey={valueKey}
        stroke="transparent"
        strokeOpacity={0}
        isAnimationActive={false}
        legendType="none"
        connectNulls
        dot={(dotProps) => {
          const rowIndex = dotProps.index ?? -1
          const stepId = data[rowIndex]?.[stepKey]
          const isLast = rowIndex === lastIndex
          return (
            <g key={`${combo.comboId}-${String(dotProps.index ?? dotProps.key)}`}>
              <SeriesDot
                cx={dotProps.cx}
                cy={dotProps.cy}
                shape={shape}
                opacity={opacity}
                highlighted={hoveredStepId !== null && stepId === hoveredStepId}
                stepId={typeof stepId === "string" && stepId !== "" ? stepId : undefined}
                onHover={onHoverStep}
                className={cx(styles.markerFill)}
              />
              {!isLast || dotProps.cx === undefined || dotProps.cy === undefined ? null : (
                <text
                  x={dotProps.cx + 6}
                  y={dotProps.cy}
                  dy={4}
                  opacity={opacity}
                  className={cx(styles.endLabel)}
                >
                  {combo.comboName}
                </text>
              )}
            </g>
          )
        }}
        activeDot={{ r: 5 }}
        {...handlers}
      />
    </>
  )
}
