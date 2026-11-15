import { useEffect, useLayoutEffect, useRef, useState } from "react"
import { createPortal } from "react-dom"
import type { ComboSeries } from "@/graph/graph-node-derivation"
import { useGraphStore } from "@/graph/store"
import type { SeriesDashStyle, SeriesOverride } from "@/graph/types"
import { cx } from "@/lib/cx"
import { computeFloatingPosition } from "@/lib/floating-position"
import styles from "./GraphNode.module.css"
import { MARKER_SHAPES } from "./SeriesDot"

export const POPOVER_LEAVE_GRACE_MS = 120
/** Dwell time before the customization popover opens, so sweeping the cursor
 * across legend entries doesn't flash popovers. */
export const POPOVER_OPEN_DELAY_MS = 400
export const POPOVER_TRANSITION_MS = 150

export const SERIES_COLOR_OPTIONS: ReadonlyArray<{
  readonly value: string
  readonly label: string
}> = [
  { value: "var(--text-primary)", label: "Primary" },
  { value: "var(--dmg-magic)", label: "Blue" },
  { value: "var(--dmg-physical)", label: "Red" },
  { value: "var(--text-secondary)", label: "Silver" },
  { value: "var(--danger)", label: "Coral" },
]

export const SERIES_STROKE_WIDTH_OPTIONS: readonly number[] = [1.5, 2.5, 3.5]

export const SERIES_DASH_STYLE_OPTIONS: ReadonlyArray<{
  readonly value: SeriesDashStyle
  readonly label: string
  readonly dasharray: string | undefined
}> = [
  { value: "solid", label: "Solid", dasharray: undefined },
  { value: "dashed", label: "Dashed", dasharray: "6 3" },
  { value: "dotted", label: "Dotted", dasharray: "2 2" },
]

export function dashStyleToDasharray(dashStyle: SeriesDashStyle): string | undefined {
  switch (dashStyle) {
    case "solid":
      return undefined
    case "dashed":
      return "6 3"
    case "dotted":
      return "2 2"
  }
}

export function dasharrayToDashStyle(dasharray: string | undefined): SeriesDashStyle {
  if (dasharray === "6 3") return "dashed"
  if (dasharray === "2 2") return "dotted"
  return "solid"
}

function LegendSwatch({
  dasharray,
  shape,
  stroke,
  strokeWidth = 1.5,
}: {
  readonly dasharray: string | undefined
  readonly shape: (typeof MARKER_SHAPES)[number]
  readonly stroke: string
  readonly strokeWidth?: number | undefined
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
        strokeWidth={strokeWidth}
        strokeDasharray={dasharray}
        className={styles.legendLine}
      />
      {shape === "square" ? (
        <rect x="9" y="3" width="6" height="6" fill={stroke} className={styles.legendMarker} />
      ) : shape === "diamond" ? (
        <polygon points="12,2 16,6 12,10 8,6" fill={stroke} className={styles.legendMarker} />
      ) : (
        <circle cx="12" cy="6" r="3" fill={stroke} className={styles.legendMarker} />
      )}
    </svg>
  )
}

function LegendEntry({
  graphNodeId,
  combo,
  shape,
  defaultColor,
  defaultDasharray,
  override,
  dimmed,
  pinned,
  onHoverSeries,
  onTogglePinSeries,
}: {
  readonly graphNodeId: string
  readonly combo: ComboSeries
  readonly shape: (typeof MARKER_SHAPES)[number]
  readonly defaultColor: string
  readonly defaultDasharray: string | undefined
  readonly override: SeriesOverride | undefined
  readonly dimmed: boolean
  readonly pinned: boolean
  readonly onHoverSeries: (series: ComboSeries | null) => void
  readonly onTogglePinSeries: (seriesId: string) => void
}) {
  const updateSeriesOverride = useGraphStore((s) => s.updateSeriesOverride)
  const [popoverOpen, setPopoverOpen] = useState(false)
  const [popoverMounted, setPopoverMounted] = useState(false)
  const [position, setPosition] = useState<{ readonly top: number; readonly left: number } | null>(
    null,
  )
  const itemRef = useRef<HTMLLIElement>(null)
  const popoverRef = useRef<HTMLDivElement>(null)
  const openTimer = useRef<ReturnType<typeof setTimeout> | undefined>(undefined)
  const closeTimer = useRef<ReturnType<typeof setTimeout> | undefined>(undefined)
  const unmountTimer = useRef<ReturnType<typeof setTimeout> | undefined>(undefined)

  const effectiveColor = override?.color ?? defaultColor
  const effectiveStrokeWidth = override?.strokeWidth ?? 1.5
  const effectiveDashStyle = override?.dashStyle ?? dasharrayToDashStyle(defaultDasharray)
  const effectiveDasharray =
    override?.dashStyle !== undefined ? dashStyleToDasharray(override.dashStyle) : defaultDasharray
  const isHidden = override?.hidden === true
  const effectiveShape = override?.shape ?? shape

  function cancelPopoverTimers() {
    window.clearTimeout(openTimer.current)
    window.clearTimeout(closeTimer.current)
    window.clearTimeout(unmountTimer.current)
  }

  function openPopover() {
    cancelPopoverTimers()
    setPopoverMounted(true)
    setPopoverOpen(true)
  }

  function scheduleOpenPopover() {
    cancelPopoverTimers()
    openTimer.current = setTimeout(openPopover, POPOVER_OPEN_DELAY_MS)
  }

  function scheduleClosePopover() {
    cancelPopoverTimers()
    closeTimer.current = setTimeout(() => {
      setPopoverOpen(false)
      unmountTimer.current = setTimeout(() => {
        setPopoverMounted(false)
        setPosition(null)
      }, POPOVER_TRANSITION_MS)
    }, POPOVER_LEAVE_GRACE_MS)
  }

  useEffect(
    () => () => {
      window.clearTimeout(openTimer.current)
      window.clearTimeout(closeTimer.current)
      window.clearTimeout(unmountTimer.current)
    },
    [],
  )

  useLayoutEffect(() => {
    if (!popoverMounted || !popoverOpen) {
      return
    }
    const triggerEl = itemRef.current
    const popoverEl = popoverRef.current
    if (triggerEl === null || popoverEl === null) {
      return
    }
    setPosition(
      computeFloatingPosition({
        trigger: triggerEl.getBoundingClientRect(),
        floating: popoverEl.getBoundingClientRect(),
        placement: "bottom",
        viewport: { width: window.innerWidth, height: window.innerHeight },
        gap: 6,
      }),
    )
  }, [popoverMounted, popoverOpen])

  const seriesDisplayName = `${combo.comboName}${
    combo.variantName === "" ? "" : ` · ${combo.variantName}`
  } vs ${combo.targetName}`

  const isVisible = popoverOpen && position !== null

  return (
    <li
      ref={itemRef}
      className={styles.legendListItem}
      onMouseEnter={() => {
        onHoverSeries(combo)
        scheduleOpenPopover()
      }}
      onMouseLeave={() => {
        onHoverSeries(null)
        scheduleClosePopover()
      }}
    >
      <button
        type="button"
        className={styles.legendItem}
        data-dimmed={dimmed || isHidden ? "true" : undefined}
        data-hidden={isHidden ? "true" : undefined}
        data-pinned={pinned ? "true" : undefined}
        onClick={() => onTogglePinSeries(combo.seriesId)}
      >
        <LegendSwatch
          dasharray={effectiveDasharray}
          shape={effectiveShape}
          stroke={effectiveColor}
          strokeWidth={effectiveStrokeWidth}
        />
        <span>{combo.comboName}</span>
        <span className={styles.legendMeta}>
          {combo.variantName === "" ? "" : `${combo.variantName} · `}vs {combo.targetName}
        </span>
      </button>
      {popoverMounted
        ? createPortal(
            <div
              ref={popoverRef}
              role="dialog"
              aria-label={`Customize ${seriesDisplayName}`}
              aria-hidden={!popoverOpen ? "true" : undefined}
              data-open={isVisible ? "true" : "false"}
              className={cx(
                "nodrag",
                "nowheel",
                "nopan",
                styles.legendPopover,
                position === null && styles.legendPopoverMeasuring,
                !isVisible && styles.legendPopoverHidden,
              )}
              style={position === null ? undefined : { top: position.top, left: position.left }}
              onMouseEnter={() => {
                openPopover()
                onHoverSeries(combo)
              }}
              onMouseLeave={() => {
                onHoverSeries(null)
                scheduleClosePopover()
              }}
            >
              <div className={styles.legendPopoverRow}>
                <span className={styles.legendPopoverLabel}>Visible</span>
                <input
                  type="checkbox"
                  checked={!isHidden}
                  aria-label={`Show ${seriesDisplayName}`}
                  onChange={(event) =>
                    updateSeriesOverride(graphNodeId, combo.seriesId, {
                      hidden: event.target.checked ? undefined : true,
                    })
                  }
                />
              </div>
              <div className={styles.legendPopoverSection}>
                <span className={styles.legendPopoverLabel}>Color</span>
                <div className={styles.legendSwatchGroup}>
                  {SERIES_COLOR_OPTIONS.map((option) => (
                    <button
                      key={option.value}
                      type="button"
                      aria-label={`Color ${option.label}`}
                      aria-pressed={effectiveColor === option.value}
                      className={styles.colorOptionButton}
                      style={{ backgroundColor: option.value }}
                      onClick={() =>
                        updateSeriesOverride(graphNodeId, combo.seriesId, {
                          color: option.value,
                        })
                      }
                    />
                  ))}
                </div>
              </div>
              <div className={styles.legendPopoverSection}>
                <span className={styles.legendPopoverLabel}>Width</span>
                <div className={styles.legendOptionGroup}>
                  {SERIES_STROKE_WIDTH_OPTIONS.map((width) => (
                    <button
                      key={width}
                      type="button"
                      aria-label={`Stroke width ${width}`}
                      aria-pressed={effectiveStrokeWidth === width}
                      className={styles.styleOptionButton}
                      onClick={() =>
                        updateSeriesOverride(graphNodeId, combo.seriesId, {
                          strokeWidth: width,
                        })
                      }
                    >
                      {width}px
                    </button>
                  ))}
                </div>
              </div>
              <div className={styles.legendPopoverSection}>
                <span className={styles.legendPopoverLabel}>Dash</span>
                <div className={styles.legendOptionGroup}>
                  {SERIES_DASH_STYLE_OPTIONS.map((option) => (
                    <button
                      key={option.value}
                      type="button"
                      aria-label={`Dash style ${option.label}`}
                      aria-pressed={effectiveDashStyle === option.value}
                      className={styles.styleOptionButton}
                      onClick={() =>
                        updateSeriesOverride(graphNodeId, combo.seriesId, {
                          dashStyle: option.value,
                        })
                      }
                    >
                      {option.label}
                    </button>
                  ))}
                </div>
              </div>
              <div className={styles.legendPopoverSection}>
                <span className={styles.legendPopoverLabel}>Shape</span>
                <div className={styles.legendOptionGroup}>
                  {MARKER_SHAPES.map((option) => (
                    <button
                      key={option}
                      type="button"
                      aria-label={`Marker shape ${option}`}
                      aria-pressed={effectiveShape === option}
                      className={styles.styleOptionButton}
                      onClick={() =>
                        updateSeriesOverride(graphNodeId, combo.seriesId, { shape: option })
                      }
                    >
                      {option.charAt(0).toUpperCase() + option.slice(1)}
                    </button>
                  ))}
                </div>
              </div>
            </div>,
            document.body,
          )
        : null}
    </li>
  )
}

/** Custom legend (DESIGN.md §7: "No default React Flow or Recharts
 * styling") — one entry per combo × item-set variant × target, showing the
 * same stroke-pattern × marker-shape encoding as the plot, doubling as the
 * hover trigger for the upstream-highlight feature (plan D11) and housing a
 * hover popover for per-series color/width/dash/visibility overrides. */
export function ChartLegend({
  graphNodeId,
  series,
  colorBySeriesId,
  targetDashById,
  seriesOverrides,
  hoveredSeriesId,
  pinnedSeriesId,
  onHoverSeries,
  onTogglePinSeries,
}: {
  readonly graphNodeId: string
  readonly series: readonly ComboSeries[]
  readonly colorBySeriesId: ReadonlyMap<string, string>
  readonly targetDashById: ReadonlyMap<string, string | undefined>
  readonly seriesOverrides: Readonly<Record<string, SeriesOverride>> | undefined
  readonly hoveredSeriesId: string | null
  readonly pinnedSeriesId: string | null
  readonly onHoverSeries: (series: ComboSeries | null) => void
  readonly onTogglePinSeries: (seriesId: string) => void
}) {
  return (
    <ul className={styles.legend}>
      {series.map((combo, index) => (
        <LegendEntry
          key={combo.seriesId}
          graphNodeId={graphNodeId}
          combo={combo}
          shape={MARKER_SHAPES[index % MARKER_SHAPES.length] ?? "circle"}
          defaultColor={colorBySeriesId.get(combo.seriesId) ?? "var(--text-primary)"}
          defaultDasharray={targetDashById.get(combo.targetId)}
          override={seriesOverrides?.[combo.seriesId]}
          dimmed={hoveredSeriesId !== null && hoveredSeriesId !== combo.seriesId}
          pinned={pinnedSeriesId === combo.seriesId}
          onHoverSeries={onHoverSeries}
          onTogglePinSeries={onTogglePinSeries}
        />
      ))}
    </ul>
  )
}
