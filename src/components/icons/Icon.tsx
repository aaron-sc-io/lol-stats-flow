import { assertNever } from "@/lib/assert-never"
import { cx } from "@/lib/cx"
import styles from "./Icon.module.css"
import { CLASS_ICON_PATHS } from "./icon-paths.class"
import { ROLE_ICON_PATHS } from "./icon-paths.role"
import { STAT_ICON_PATHS } from "./icon-paths.stat"
import { UI_ICON_PATHS } from "./icon-paths.ui"
import type { IconDefinition, IconShape } from "./icon-shape"

const ICON_PATHS = {
  ...UI_ICON_PATHS,
  ...ROLE_ICON_PATHS,
  ...CLASS_ICON_PATHS,
  ...STAT_ICON_PATHS,
} as const satisfies Record<string, IconDefinition>

export type IconName = keyof typeof ICON_PATHS
export type IconSize = 16 | 20 | 24

export const ICON_NAMES = Object.keys(ICON_PATHS) as readonly IconName[]

export type IconProps = {
  readonly name: IconName
  readonly size?: IconSize | undefined
  readonly className?: string | undefined
  /** When set, the icon is meaningful content (renders `<title>`, loses
   * `aria-hidden`). Omit for every purely decorative icon — the overwhelming
   * majority, since the label lives on the IconButton/Tooltip instead. */
  readonly title?: string | undefined
}

export function Icon({ name, size = 20, className, title }: IconProps) {
  const definition = ICON_PATHS[name]
  const shapes = definition.map((shape, index) => (
    // biome-ignore lint/suspicious/noArrayIndexKey: shape lists are static per icon, never reordered
    <Shape key={index} shape={shape} />
  ))

  if (title === undefined) {
    return (
      <svg
        width={size}
        height={size}
        viewBox="0 0 24 24"
        fill="none"
        stroke="currentColor"
        strokeWidth={1.5}
        strokeLinecap="round"
        strokeLinejoin="round"
        className={cx(styles.icon, className)}
        aria-hidden="true"
        focusable="false"
      >
        {shapes}
      </svg>
    )
  }

  return (
    <svg
      width={size}
      height={size}
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      strokeWidth={1.5}
      strokeLinecap="round"
      strokeLinejoin="round"
      className={cx(styles.icon, className)}
      role="img"
      focusable="false"
    >
      <title>{title}</title>
      {shapes}
    </svg>
  )
}

function Shape({ shape }: { readonly shape: IconShape }) {
  switch (shape.kind) {
    case "path":
      return (
        <path
          d={shape.d}
          fill={shape.filled === true ? "currentColor" : "none"}
          stroke={shape.filled === true ? "none" : "currentColor"}
        />
      )
    case "circle":
      return (
        <circle
          cx={shape.cx}
          cy={shape.cy}
          r={shape.r}
          fill={shape.filled === true ? "currentColor" : "none"}
          stroke={shape.filled === true ? "none" : "currentColor"}
          strokeDasharray={shape.dashed === true ? "2 2" : undefined}
        />
      )
    case "rect":
      return (
        <rect
          x={shape.x}
          y={shape.y}
          width={shape.width}
          height={shape.height}
          rx={shape.rx}
          fill="none"
          stroke="currentColor"
        />
      )
    default:
      return assertNever(shape)
  }
}
