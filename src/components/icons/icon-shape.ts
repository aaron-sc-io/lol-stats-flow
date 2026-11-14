/**
 * Shared geometry types for the hand-drawn icon set. Every icon is a short
 * list of primitive SVG shapes on a 24×24 grid — no copy-pasted path data
 * from any icon library, no Riot assets. Keeping icons data-driven (instead
 * of one React component per icon) is what keeps ~34 icons under a sane
 * line count: see `icon-paths.*.ts`.
 */
export type IconShape =
  | { readonly kind: "path"; readonly d: string; readonly filled?: boolean }
  | {
      readonly kind: "circle"
      readonly cx: number
      readonly cy: number
      readonly r: number
      readonly filled?: boolean
      readonly dashed?: boolean
    }
  | {
      readonly kind: "rect"
      readonly x: number
      readonly y: number
      readonly width: number
      readonly height: number
      readonly rx?: number
    }

export type IconDefinition = readonly IconShape[]
