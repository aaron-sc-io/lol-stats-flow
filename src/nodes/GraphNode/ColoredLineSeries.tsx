import { Line, LineDrawShape, type LineDrawShapeProps } from "recharts"
import type { DamageInstance } from "@/engine"
import { ORIGIN_X } from "@/graph/chart-points"
import { type ComboSeries, seriesLabel } from "@/graph/graph-node-derivation"
import type { HoveredDamage } from "@/graph/store-types"
import { cx } from "@/lib/cx"
import styles from "./GraphNode.module.css"
import type { MarkerShape } from "./SeriesDot"
import { SeriesDot } from "./SeriesDot"

export type MergedRow = { readonly x: number; readonly xLabel: string } & Record<
  string,
  number | string | readonly DamageInstance[]
>

const BASE_STROKE_WIDTH = 1.5
const EMPHASIZED_STROKE_WIDTH = 2.5
const HOVERED_SEGMENT_STROKE_WIDTH = 4

type PlottedPoint = { readonly x: number; readonly y: number; readonly row: MergedRow }

/** The step that dealt a row's damage on this series: the row's own step id
 * in step mode, or (tick mode, where rows aren't 1:1 with steps) the step
 * that caused the row's single damage instance. */
function rowStepId(row: MergedRow, seriesId: string): string | null {
  const stepId = row[`${seriesId}.stepId`]
  if (typeof stepId === "string" && stepId !== "") {
    return stepId
  }
  const instances = row[`${seriesId}.instances`]
  return Array.isArray(instances)
    ? ((instances[0] as DamageInstance | undefined)?.stepId ?? null)
    : null
}

/** One combo line: visible stroke + markers + end-of-line label, plus one
 * invisible hover target per line segment. A segment (previous point → this
 * point) *is* this point's damage, so hovering it bolds just that segment
 * and reports it as the hovered damage — which the combo timeline maps back
 * to the matching step's damage chip. */
export function ColoredLineSeries({
  combo,
  rows,
  dataKeySuffix,
  stroke,
  dasharray,
  shape,
  opacity,
  emphasized,
  hoveredStepId,
  hoveredStepIds,
  hoveredDamage,
  onHoverStep,
  onHoverDamage,
}: {
  readonly combo: ComboSeries
  /** The `<LineChart data>` rows — Recharts hands the line's `shape` one
   * point per row, in this same order. */
  readonly rows: readonly MergedRow[]
  readonly dataKeySuffix: "cumulative" | "targetHpAfter"
  readonly stroke: string
  readonly dasharray: string | undefined
  readonly shape: MarkerShape
  readonly opacity: number
  readonly emphasized: boolean
  readonly hoveredStepId: string | null
  readonly hoveredStepIds: readonly string[]
  readonly hoveredDamage: HoveredDamage | null
  readonly onHoverStep: (stepId: string | null) => void
  readonly onHoverDamage: (damage: HoveredDamage | null) => void
}) {
  const valueKey = `${combo.seriesId}.${dataKeySuffix}`
  const stepKey = `${combo.seriesId}.stepId`
  const lastStepId = combo.stepIds[combo.stepIds.length - 1] ?? null
  const lastX = combo.points[combo.points.length - 1]?.x ?? null
  const hoveredStepIdSet = new Set(hoveredStepIds)
  const hoveredX = hoveredDamage?.seriesId === combo.seriesId ? hoveredDamage.x : null

  const renderShape = (props: LineDrawShapeProps) => {
    // `connectNulls`: a row this series has no value for (another combo's
    // extra step/tick) is skipped, so segments join the plotted points only.
    const plotted: PlottedPoint[] = []
    for (const [index, point] of (props.points ?? []).entries()) {
      const row = rows[index]
      if (row !== undefined && typeof point.x === "number" && typeof point.y === "number") {
        plotted.push({ x: point.x, y: point.y, row })
      }
    }
    const segments = plotted.slice(1).map((end, index) => ({
      start: plotted[index] as PlottedPoint,
      end,
    }))
    const dashProps = dasharray === undefined ? {} : { strokeDasharray: dasharray }

    return (
      <g>
        <LineDrawShape {...props} />
        {segments.map(({ start, end }) =>
          end.row.x !== hoveredX ? null : (
            <path
              key="hovered"
              d={`M${start.x},${start.y}L${end.x},${end.y}`}
              stroke={stroke}
              strokeWidth={HOVERED_SEGMENT_STROKE_WIDTH}
              strokeOpacity={opacity}
              strokeLinecap="round"
              fill="none"
              pointerEvents="none"
              {...dashProps}
            />
          ),
        )}
        {segments.map(({ start, end }) => (
          // biome-ignore lint/a11y/noStaticElementInteractions: hover-only cross-highlight affordance — the tooltip, timeline chips, and comparison table carry the same numbers for non-pointer users.
          <path
            key={end.row.x}
            d={`M${start.x},${start.y}L${end.x},${end.y}`}
            className={cx(styles.segmentHitArea)}
            onMouseEnter={() =>
              onHoverDamage({
                seriesId: combo.seriesId,
                comboId: combo.comboId,
                variantId: combo.variantId,
                stepId: rowStepId(end.row, combo.seriesId),
                x: end.row.x,
              })
            }
            onMouseLeave={() => onHoverDamage(null)}
          />
        ))}
      </g>
    )
  }

  return (
    <Line
      type="linear"
      // Critical: keep series on the parent <LineChart data={...}> domain.
      // Passing a per-line `data` prop makes Recharts merge category entries
      // from each child series, duplicating/out-of-order x-axis labels.
      dataKey={valueKey}
      stroke={stroke}
      strokeWidth={emphasized ? EMPHASIZED_STROKE_WIDTH : BASE_STROKE_WIDTH}
      strokeOpacity={opacity}
      {...(dasharray === undefined ? {} : { strokeDasharray: dasharray })}
      isAnimationActive={false}
      legendType="none"
      connectNulls
      shape={renderShape}
      dot={(dotProps) => {
        const key = `${combo.seriesId}-${String(dotProps.index ?? dotProps.key)}`
        const rowX = dotProps.payload?.x
        // The zero-damage origin is where every line starts, not a step.
        if (rowX === ORIGIN_X) {
          return <g key={key} />
        }
        const stepId = dotProps.payload?.[stepKey]
        const isLast =
          (typeof stepId === "string" && stepId === lastStepId) ||
          (typeof rowX === "number" && lastX !== null && rowX === lastX)
        return (
          <g key={key}>
            <SeriesDot
              cx={dotProps.cx}
              cy={dotProps.cy}
              shape={shape}
              opacity={opacity}
              highlighted={
                (hoveredStepId !== null && stepId === hoveredStepId) ||
                (typeof stepId === "string" && hoveredStepIdSet.has(stepId))
              }
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
                {seriesLabel(combo)}
              </text>
            )}
          </g>
        )
      }}
      // Hover feedback is the bolded segment alone — no enlarged point.
      activeDot={false}
    />
  )
}
