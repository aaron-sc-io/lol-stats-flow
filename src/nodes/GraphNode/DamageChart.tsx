import { useEffect, useLayoutEffect, useMemo, useRef, useState } from "react"
import { createPortal } from "react-dom"
import { CartesianGrid, LineChart, ResponsiveContainer, Tooltip, XAxis, YAxis } from "recharts"
import { type ComboSeries, type StepIconMeta, seriesLabel } from "@/graph/graph-node-derivation"
import { useGraphStore } from "@/graph/store"
import type { HoveredDamage } from "@/graph/store-types"
import type { ChartType, SeriesOverride, XMode } from "@/graph/types"
import { cx } from "@/lib/cx"
import { computeFloatingPosition } from "@/lib/floating-position"
import { ChartLegend, dashStyleToDasharray } from "./ChartLegend"
import { ChartBreakdownCard, ChartTooltip } from "./ChartTooltip"
import { ColoredLineSeries, type MergedRow } from "./ColoredLineSeries"
import styles from "./GraphNode.module.css"
import { MARKER_SHAPES, STROKE_DASHARRAYS } from "./SeriesDot"

const MIN_LABEL_MARGIN = 56
const MAX_LABEL_MARGIN = 220
/** Recharts' default YAxis width, pinned so the legend can inset to match. */
const Y_AXIS_WIDTH = 60
const SERIES_COLORS = [
  "var(--text-primary)",
  "var(--dmg-magic)",
  "var(--dmg-physical)",
  "var(--text-secondary)",
] as const

function intersects(left: readonly string[], right: ReadonlySet<string>): boolean {
  return left.some((value) => right.has(value))
}

/** One shared dataset keyed by `x` (step index, or tick-mode seconds) with
 * per-combo keys — the canonical Recharts multi-series shape, robust
 * regardless of whether combos have different step counts or (in tick
 * mode) non-aligned instance times. */
export function mergeSeriesForChart(series: readonly ComboSeries[]): MergedRow[] {
  const byX = new Map<number, MergedRow>()
  for (const item of series) {
    for (const point of item.points) {
      const row: MergedRow = byX.get(point.x) ?? { x: point.x, xLabel: point.xLabel }
      row[`${item.seriesId}.physical`] = point.physical
      row[`${item.seriesId}.magic`] = point.magic
      row[`${item.seriesId}.true`] = point.true
      row[`${item.seriesId}.cumulative`] = point.cumulative
      row[`${item.seriesId}.targetHpAfter`] = point.targetHpAfter
      row[`${item.seriesId}.stepId`] = point.stepId ?? ""
      row[`${item.seriesId}.instances`] = point.instances
      byX.set(point.x, row)
    }
  }
  return [...byX.values()].sort((a, b) => a.x - b.x)
}

function lineDataKey(chartType: ChartType): "cumulative" | "targetHpAfter" {
  return chartType === "hp" ? "targetHpAfter" : "cumulative"
}

/** One color per combo × item-set variant; targets differ by dash pattern. */
function colorKey(item: ComboSeries): string {
  return `${item.comboId}__${item.variantId}`
}

/** Unique ability icons at step index `stepIndex` across all visible series. */
function stepIconsAtStepIndex(
  series: readonly ComboSeries[],
  stepIndex: number,
): readonly StepIconMeta[] {
  const seen = new Set<string>()
  const icons: StepIconMeta[] = []
  for (const item of series) {
    const icon = item.stepIcons?.[stepIndex]
    if (icon === undefined) continue
    const dedupeKey = `${icon.iconUrl ?? "aa"}__${icon.keyLabel}`
    if (!seen.has(dedupeKey)) {
      seen.add(dedupeKey)
      icons.push(icon)
    }
  }
  return icons
}

function StepIconTick({
  x,
  y,
  payload,
  rows,
  series,
  onHoverStepIds,
}: {
  readonly x?: string | number | undefined
  readonly y?: string | number | undefined
  readonly payload?: { readonly value?: string | number; readonly index?: number } | undefined
  readonly rows: readonly MergedRow[]
  readonly series: readonly ComboSeries[]
  readonly onHoverStepIds: (stepIds: readonly string[]) => void
}) {
  const [hovered, setHovered] = useState(false)
  const [position, setPosition] = useState<{ readonly top: number; readonly left: number } | null>(
    null,
  )
  const triggerRef = useRef<HTMLDivElement>(null)
  const tooltipRef = useRef<HTMLDivElement>(null)

  const rowIndex = payload?.index
  const row =
    (rowIndex !== undefined ? rows[rowIndex] : undefined) ??
    rows.find((candidate) => candidate.xLabel === String(payload?.value ?? ""))
  const stepIndex = row !== undefined && row.x >= 0 ? Math.round(row.x) : -1
  const icons = stepIndex >= 0 ? stepIconsAtStepIndex(series, stepIndex) : []
  const stepIds =
    stepIndex >= 0
      ? series
          .map((item) => item.stepIds[stepIndex])
          .filter((id): id is string => id !== undefined && id !== "")
      : []

  useLayoutEffect(() => {
    if (!hovered) {
      return
    }
    const triggerEl = triggerRef.current
    const tooltipEl = tooltipRef.current
    if (triggerEl === null || tooltipEl === null) {
      return
    }
    setPosition(
      computeFloatingPosition({
        trigger: triggerEl.getBoundingClientRect(),
        floating: tooltipEl.getBoundingClientRect(),
        placement: "bottom",
        viewport: { width: window.innerWidth, height: window.innerHeight },
        gap: 6,
      }),
    )
  }, [hovered])

  const numX = typeof x === "number" ? x : Number(x)
  const numY = typeof y === "number" ? y : Number(y)
  if (!Number.isFinite(numX) || !Number.isFinite(numY) || row === undefined) {
    return <g />
  }

  // Step 0 (origin) has no ability icon.
  if (stepIndex < 0) {
    return (
      <g transform={`translate(${numX},${numY})`}>
        <circle cx={0} cy={18} r={2.5} className={styles.originTickDot} />
      </g>
    )
  }
  const size = 34
  const gap = 4
  const totalWidth = icons.length === 0 ? size : icons.length * size + (icons.length - 1) * gap
  const startX = -totalWidth / 2
  const topY = 6
  const clipPrefix = `step-tick-${stepIndex}`

  return (
    // biome-ignore lint/a11y/noStaticElementInteractions: hover-only SVG axis tick target showing the step breakdown tooltip
    <g
      transform={`translate(${numX},${numY})`}
      className={styles.stepIconTickGroup}
      data-step-tick={row.xLabel}
      onMouseEnter={() => {
        setHovered(true)
        onHoverStepIds(stepIds)
      }}
      onMouseLeave={() => {
        setHovered(false)
        setPosition(null)
        onHoverStepIds([])
      }}
    >
      <foreignObject
        x={startX}
        y={topY}
        width={totalWidth}
        height={size}
        className={styles.stepTickForeignObject}
      >
        <div ref={triggerRef} role="img" aria-label={row.xLabel} className={styles.stepIconTick} />
      </foreignObject>
      {icons.length === 0 ? (
        <g>
          <rect
            x={startX}
            y={topY}
            width={size}
            height={size}
            rx={4}
            className={styles.stepTickSvgBox}
          />
          <text
            x={0}
            y={topY + size / 2}
            dy={4}
            textAnchor="middle"
            className={styles.stepTickFallbackSvg}
          >
            {stepIndex + 1}
          </text>
        </g>
      ) : (
        icons.map((icon, idx) => {
          const ix = startX + idx * (size + gap)
          const clipId = `${clipPrefix}-${icon.stepId}`
          const badgeWidth = Math.max(12, icon.keyLabel.length * 6.5 + 4)
          const badgeHeight = 11
          return (
            <g key={icon.stepId} transform={`translate(${ix},${topY})`}>
              <title>{icon.actionLabel}</title>
              <defs>
                <clipPath id={clipId}>
                  <rect x={0} y={0} width={size} height={size} rx={4} />
                </clipPath>
              </defs>
              <rect
                x={0}
                y={0}
                width={size}
                height={size}
                rx={4}
                className={styles.stepTickSvgBox}
              />
              {icon.iconUrl !== undefined ? (
                <image
                  href={icon.iconUrl}
                  x={0}
                  y={0}
                  width={size}
                  height={size}
                  preserveAspectRatio="xMidYMid slice"
                  clipPath={`url(#${clipId})`}
                />
              ) : (
                <svg
                  x={3}
                  y={3}
                  width={size - 6}
                  height={size - 6}
                  viewBox="2 2 20 20"
                  fill="none"
                  stroke="currentColor"
                  strokeWidth={1.6}
                  strokeLinecap="round"
                  strokeLinejoin="round"
                  aria-hidden="true"
                  focusable="false"
                  className={styles.stepTickSwordSvg}
                >
                  <path d="M14.5 3.5L20.5 3.5L20.5 9.5L10.5 19.5L4.5 13.5Z" />
                  <path d="M7.5 16.5L3.5 20.5" />
                  <path d="M5.5 11.5L12.5 18.5" />
                </svg>
              )}
              <rect
                x={size - badgeWidth - 1}
                y={size - badgeHeight - 1}
                width={badgeWidth}
                height={badgeHeight}
                rx={2}
                className={styles.stepTickBadgeBg}
              />
              <text
                x={size - badgeWidth / 2 - 1}
                y={size - 3}
                textAnchor="middle"
                className={styles.stepTickBadgeText}
              >
                {icon.keyLabel}
              </text>
            </g>
          )
        })
      )}
      {hovered
        ? createPortal(
            <div
              ref={tooltipRef}
              role="tooltip"
              className={cx(
                styles.stepTickTooltipPortal,
                position === null && styles.legendPopoverMeasuring,
              )}
              style={position === null ? undefined : { top: position.top, left: position.left }}
            >
              <ChartBreakdownCard label={row.xLabel} row={row} series={series} />
            </div>,
            document.body,
          )
        : null}
    </g>
  )
}

export function DamageChart({
  graphNodeId = "",
  series,
  chartType,
  xMode = "step",
  seriesOverrides,
  height,
}: {
  readonly graphNodeId?: string | undefined
  readonly series: readonly ComboSeries[]
  readonly chartType: ChartType
  readonly xMode?: XMode | undefined
  readonly seriesOverrides?: Readonly<Record<string, SeriesOverride>> | undefined
  readonly height: number
}) {
  const hoveredComboId = useGraphStore((s) => s.hoveredComboId)
  const hoveredGraphSeriesId = useGraphStore((s) => s.hoveredGraphSeriesId)
  const hoveredStepId = useGraphStore((s) => s.hoveredStepId)
  const hoveredStepIds = useGraphStore((s) => s.hoveredStepIds)
  const hoveredItemSetIds = useGraphStore((s) => s.hoveredItemSetIds)
  const hoveredDamage = useGraphStore((s) => s.hoveredDamage)
  const pinnedGraphSeriesId = useGraphStore((s) => s.pinnedGraphSeriesId)
  const setHoveredCombo = useGraphStore((s) => s.setHoveredCombo)
  const setHoveredGraphSeries = useGraphStore((s) => s.setHoveredGraphSeries)
  const setHoveredStep = useGraphStore((s) => s.setHoveredStep)
  const setHoveredSteps = useGraphStore((s) => s.setHoveredSteps)
  const setHoveredItemSet = useGraphStore((s) => s.setHoveredItemSet)
  const setHoveredItemSets = useGraphStore((s) => s.setHoveredItemSets)
  const setHoveredDamage = useGraphStore((s) => s.setHoveredDamage)
  const setPinnedGraphSeries = useGraphStore((s) => s.setPinnedGraphSeries)

  const visibleSeries = useMemo(
    () => series.filter((item) => seriesOverrides?.[item.seriesId]?.hidden !== true),
    [series, seriesOverrides],
  )

  const activePinnedSeriesId =
    pinnedGraphSeriesId !== null &&
    visibleSeries.some((item) => item.seriesId === pinnedGraphSeriesId)
      ? pinnedGraphSeriesId
      : null

  useEffect(() => {
    if (pinnedGraphSeriesId !== null && activePinnedSeriesId === null) {
      setPinnedGraphSeries(null)
    }
  }, [pinnedGraphSeriesId, activePinnedSeriesId, setPinnedGraphSeries])

  if (series.length === 0) {
    return <p className={styles.emptyState}>Connect a combo to see its damage.</p>
  }

  const data = mergeSeriesForChart(visibleSeries)
  // Room for the end-of-line labels (~6px per char at their 11px font).
  const labelMargin = Math.min(
    MAX_LABEL_MARGIN,
    Math.max(
      MIN_LABEL_MARGIN,
      12 + 6 * Math.max(0, ...visibleSeries.map((item) => seriesLabel(item).length)),
    ),
  )
  const colorBySeriesId = new Map<string, string>()
  const colorByKey = new Map<string, string>()
  const targetDashById = new Map<string, string | undefined>()
  let targetDashIndex = 0
  for (const item of series) {
    const key = colorKey(item)
    if (!colorByKey.has(key)) {
      colorByKey.set(
        key,
        SERIES_COLORS[colorByKey.size % SERIES_COLORS.length] ?? "var(--text-primary)",
      )
    }
    colorBySeriesId.set(item.seriesId, colorByKey.get(key) ?? "var(--text-primary)")
    if (!targetDashById.has(item.targetId)) {
      targetDashById.set(
        item.targetId,
        STROKE_DASHARRAYS[targetDashIndex % STROKE_DASHARRAYS.length],
      )
      targetDashIndex += 1
    }
  }

  const effectiveHoveredSeriesId = activePinnedSeriesId ?? hoveredGraphSeriesId

  const hoveredStepIdSet = new Set(hoveredStepIds)
  const hoveredItemSetIdSet = new Set(hoveredItemSetIds)
  const hasHoverSelection =
    effectiveHoveredSeriesId !== null ||
    hoveredComboId !== null ||
    hoveredStepIdSet.size > 0 ||
    hoveredItemSetIdSet.size > 0

  const matchesHighlight = (item: ComboSeries): boolean => {
    if (effectiveHoveredSeriesId !== null) {
      return item.seriesId === effectiveHoveredSeriesId
    }
    if (hoveredStepIdSet.size > 0 && intersects(item.stepIds, hoveredStepIdSet)) {
      return true
    }
    if (hoveredItemSetIdSet.size > 0 && intersects(item.itemSetIds, hoveredItemSetIdSet)) {
      return true
    }
    if (hoveredComboId !== null) {
      return item.comboId === hoveredComboId
    }
    return true
  }

  const styleFor = (item: ComboSeries) => {
    const highlighted = matchesHighlight(item)
    if (!hasHoverSelection) {
      return { opacity: 1, emphasized: false }
    }
    if (!highlighted) {
      return { opacity: 0.25, emphasized: false }
    }
    // A hovered segment bolds itself only (unless pinned).
    return {
      opacity: 1,
      emphasized: hoveredDamage === null || activePinnedSeriesId === item.seriesId,
    }
  }

  const hoverSeries = (item: ComboSeries | null) => {
    if (item === null) {
      if (activePinnedSeriesId !== null) {
        const pinned = visibleSeries.find((s) => s.seriesId === activePinnedSeriesId)
        if (pinned !== undefined) {
          setHoveredGraphSeries(pinned.seriesId)
          setHoveredCombo(pinned.comboId)
          setHoveredSteps([])
          setHoveredStep(null)
          setHoveredItemSets(pinned.itemSetIds)
          setHoveredItemSet(pinned.itemSetIds[0] ?? null)
          return
        }
      }
      setHoveredGraphSeries(null)
      setHoveredCombo(null)
      setHoveredSteps([])
      setHoveredStep(null)
      setHoveredItemSets([])
      setHoveredItemSet(null)
      return
    }
    setHoveredGraphSeries(item.seriesId)
    setHoveredCombo(item.comboId)
    setHoveredSteps(item.stepIds)
    setHoveredStep(item.stepIds[0] ?? null)
    setHoveredItemSets(item.itemSetIds)
    setHoveredItemSet(item.itemSetIds[0] ?? null)
  }

  const hoverStep = (stepId: string | null) => {
    setHoveredStep(stepId)
    setHoveredSteps(stepId === null ? [] : [stepId])
  }

  const hoverStepIds = (stepIds: readonly string[]) => {
    setHoveredSteps(stepIds)
    setHoveredStep(stepIds[0] ?? null)
  }

  const togglePinSeries = (seriesId: string) => {
    if (activePinnedSeriesId === seriesId) {
      setPinnedGraphSeries(null)
      setHoveredGraphSeries(null)
      setHoveredCombo(null)
      setHoveredItemSets([])
      setHoveredItemSet(null)
      return
    }
    const targetSeries = visibleSeries.find((s) => s.seriesId === seriesId)
    setPinnedGraphSeries(seriesId)
    if (targetSeries !== undefined) {
      setHoveredGraphSeries(targetSeries.seriesId)
      setHoveredCombo(targetSeries.comboId)
      setHoveredItemSets(targetSeries.itemSetIds)
      setHoveredItemSet(targetSeries.itemSetIds[0] ?? null)
    }
  }

  /** A line segment: focus its series (or keep pinned series as priority) and
   * point the combo timeline at that one damage chip. */
  const hoverDamage = (item: ComboSeries, damage: HoveredDamage | null) => {
    if (activePinnedSeriesId !== null && damage !== null) {
      const pinned = visibleSeries.find((s) => s.seriesId === activePinnedSeriesId)
      if (pinned !== undefined) {
        const pinnedRow = data.find((row) => row.x === damage.x)
        const pinnedStepId =
          typeof pinnedRow?.[`${pinned.seriesId}.stepId`] === "string"
            ? (pinnedRow[`${pinned.seriesId}.stepId`] as string)
            : null
        setHoveredDamage({
          seriesId: pinned.seriesId,
          comboId: pinned.comboId,
          variantId: pinned.variantId,
          stepId: pinnedStepId === "" ? null : pinnedStepId,
          x: damage.x,
        })
        setHoveredGraphSeries(pinned.seriesId)
        setHoveredCombo(pinned.comboId)
        setHoveredItemSets(pinned.itemSetIds)
        return
      }
    }
    setHoveredDamage(damage)
    if (damage === null && activePinnedSeriesId !== null) {
      const pinned = visibleSeries.find((s) => s.seriesId === activePinnedSeriesId)
      setHoveredGraphSeries(pinned?.seriesId ?? null)
      setHoveredCombo(pinned?.comboId ?? null)
      setHoveredItemSets(pinned?.itemSetIds ?? [])
      return
    }
    setHoveredGraphSeries(damage === null ? null : item.seriesId)
    setHoveredCombo(damage === null ? null : item.comboId)
    setHoveredItemSets(damage === null ? [] : item.itemSetIds)
  }

  const tooltipRow =
    hoveredDamage === null ? undefined : data.find((row) => row.x === hoveredDamage.x)

  const targetSeriesId = activePinnedSeriesId ?? hoveredDamage?.seriesId ?? null

  return (
    // biome-ignore lint/a11y/noStaticElementInteractions: clicking empty chart area unpins a pinned series
    // biome-ignore lint/a11y/useKeyWithClickEvents: legend buttons provide keyboard-accessible unpinning
    <div
      className={styles.chartWrap}
      data-pinned-series={activePinnedSeriesId ?? undefined}
      onClick={() => {
        if (activePinnedSeriesId !== null) {
          setPinnedGraphSeries(null)
          setHoveredGraphSeries(null)
          setHoveredCombo(null)
          setHoveredItemSets([])
          setHoveredItemSet(null)
        }
      }}
    >
      {/* Inset to the plot area's x-bounds: YAxis (default 60px) on the left,
          the end-label margin on the right. */}
      <div style={{ paddingLeft: Y_AXIS_WIDTH, paddingRight: labelMargin, minWidth: 0 }}>
        <ChartLegend
          graphNodeId={graphNodeId}
          series={series}
          colorBySeriesId={colorBySeriesId}
          targetDashById={targetDashById}
          seriesOverrides={seriesOverrides}
          hoveredSeriesId={effectiveHoveredSeriesId}
          pinnedSeriesId={activePinnedSeriesId}
          onHoverSeries={hoverSeries}
          onTogglePinSeries={togglePinSeries}
        />
      </div>
      <ResponsiveContainer width="100%" height={height}>
        <LineChart
          data={data}
          className="nodrag nowheel"
          margin={{ right: labelMargin, bottom: xMode === "step" ? 12 : 0 }}
        >
          <CartesianGrid vertical={false} className={cx(styles.grid)} />
          <XAxis
            dataKey="xLabel"
            className={cx(styles.axis)}
            height={xMode === "step" ? 56 : 30}
            {...(xMode === "step"
              ? {
                  interval: 0,
                  tick: (tickProps) => (
                    <StepIconTick
                      x={tickProps.x}
                      y={tickProps.y}
                      payload={tickProps.payload}
                      rows={data}
                      series={visibleSeries}
                      onHoverStepIds={hoverStepIds}
                    />
                  ),
                }
              : {})}
          />
          <YAxis width={Y_AXIS_WIDTH} className={cx(styles.axis)} />
          <Tooltip
            content={
              <ChartTooltip
                series={visibleSeries}
                hoveredRow={tooltipRow}
                targetSeriesId={targetSeriesId}
                pinnedSeriesId={activePinnedSeriesId}
              />
            }
            // Recharts' cursor marks the *nearest* x, which mid-segment can
            // be the segment's start rather than the damage it represents.
            cursor={hoveredDamage === null && activePinnedSeriesId !== null}
          />
          {series.map((item, index) => {
            const override = seriesOverrides?.[item.seriesId]
            if (override?.hidden === true) {
              return null
            }
            const effectiveStroke =
              override?.color ?? colorBySeriesId.get(item.seriesId) ?? "var(--text-primary)"
            const effectiveDasharray =
              override?.dashStyle !== undefined
                ? dashStyleToDasharray(override.dashStyle)
                : targetDashById.get(item.targetId)
            return (
              <ColoredLineSeries
                key={item.seriesId}
                combo={item}
                rows={data}
                dataKeySuffix={lineDataKey(chartType)}
                stroke={effectiveStroke}
                strokeWidthOverride={override?.strokeWidth}
                dasharray={effectiveDasharray}
                shape={override?.shape ?? MARKER_SHAPES[index % MARKER_SHAPES.length] ?? "circle"}
                opacity={styleFor(item).opacity}
                emphasized={styleFor(item).emphasized}
                hoveredStepId={hoveredStepId}
                hoveredStepIds={hoveredStepIds}
                hoveredDamage={hoveredDamage}
                onHoverStep={hoverStep}
                onHoverDamage={(damage) => hoverDamage(item, damage)}
                onClickLine={() => togglePinSeries(item.seriesId)}
              />
            )
          })}
        </LineChart>
      </ResponsiveContainer>
    </div>
  )
}
