export const STROKE_DASHARRAYS: ReadonlyArray<string | undefined> = [undefined, "6 3", "2 2"]
export const MARKER_SHAPES = ["circle", "square", "diamond"] as const
export type MarkerShape = (typeof MARKER_SHAPES)[number]

const MARKER_SIZE = 4

/** Custom Recharts `<Line dot>` renderer (DESIGN.md §6: "Combo series are
 * distinguished by stroke pattern × marker shape ... plus a direct label").
 * Also the timeline-entry ↔ chart-point cross-highlight target: a
 * `stepId`-carrying dot grows and fills solid when its step is hovered. */
export function SeriesDot({
  cx,
  cy,
  shape,
  opacity,
  highlighted,
  stepId,
  onHover,
  onClick,
  className,
}: {
  readonly cx: number | undefined
  readonly cy: number | undefined
  readonly shape: MarkerShape
  readonly opacity: number
  readonly highlighted: boolean
  readonly stepId?: string | undefined
  readonly onHover: (stepId: string | null) => void
  readonly onClick?: (() => void) | undefined
  readonly className: string
}) {
  if (cx === undefined || cy === undefined) {
    return null
  }
  const size = highlighted ? MARKER_SIZE * 1.5 : MARKER_SIZE
  const handlers = {
    className,
    style: { opacity },
    onMouseEnter: () => onHover(stepId ?? null),
    onMouseLeave: () => onHover(null),
    onClick: (event: { stopPropagation: () => void }) => {
      event.stopPropagation()
      onClick?.()
    },
  }

  if (shape === "square") {
    return <rect x={cx - size} y={cy - size} width={size * 2} height={size * 2} {...handlers} />
  }
  if (shape === "diamond") {
    return (
      <polygon
        points={`${cx},${cy - size} ${cx + size},${cy} ${cx},${cy + size} ${cx - size},${cy}`}
        {...handlers}
      />
    )
  }
  return <circle cx={cx} cy={cy} r={size} {...handlers} />
}
