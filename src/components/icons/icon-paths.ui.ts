import type { IconDefinition } from "./icon-shape"

/**
 * General-purpose chrome icons: app shell, combo timeline, graph toolbar.
 * All original minimalist line drawings on a 24×24 grid, 1.5px stroke.
 */
export const UI_ICON_PATHS = {
  menu: [
    { kind: "path", d: "M4 6H20" },
    { kind: "path", d: "M4 12H20" },
    { kind: "path", d: "M4 18H20" },
  ],
  close: [
    { kind: "path", d: "M6 6L18 18" },
    { kind: "path", d: "M18 6L6 18" },
  ],
  search: [
    { kind: "circle", cx: 10, cy: 10, r: 6 },
    { kind: "path", d: "M14.5 14.5L20 20" },
  ],
  plus: [
    { kind: "path", d: "M12 5V19" },
    { kind: "path", d: "M5 12H19" },
  ],
  minus: [{ kind: "path", d: "M5.35 12H18.65" }],
  trash: [
    { kind: "path", d: "M4 7H20" },
    { kind: "path", d: "M9 7V4.5C9 3.7 9.7 3 10.5 3H13.5C14.3 3 15 3.7 15 4.5V7" },
    { kind: "path", d: "M6 7L7 20C7 20.8 7.7 21.5 8.5 21.5H15.5C16.3 21.5 17 20.8 17 20L18 7" },
    { kind: "path", d: "M10 11V18" },
    { kind: "path", d: "M14 11V18" },
  ],
  grip: [
    { kind: "circle", cx: 9, cy: 6, r: 1.4, filled: true },
    { kind: "circle", cx: 15, cy: 6, r: 1.4, filled: true },
    { kind: "circle", cx: 9, cy: 12, r: 1.4, filled: true },
    { kind: "circle", cx: 15, cy: 12, r: 1.4, filled: true },
    { kind: "circle", cx: 9, cy: 18, r: 1.4, filled: true },
    { kind: "circle", cx: 15, cy: 18, r: 1.4, filled: true },
  ],
  "chevron-down": [{ kind: "path", d: "M6 9L12 15L18 9" }],
  "chevron-right": [{ kind: "path", d: "M9 6L15 12L9 18" }],
  undo: [
    { kind: "path", d: "M5 7H14.5C17.5 7 20 9.5 20 12.5C20 15.5 17.5 18 14.5 18H9" },
    { kind: "path", d: "M9 3L5 7L9 11" },
  ],
  redo: [
    { kind: "path", d: "M19 7H9.5C6.5 7 4 9.5 4 12.5C4 15.5 6.5 18 9.5 18H15" },
    { kind: "path", d: "M15 3L19 7L15 11" },
  ],
  link: [
    { kind: "rect", x: 3, y: 8, width: 10, height: 8, rx: 4 },
    { kind: "rect", x: 11, y: 8, width: 10, height: 8, rx: 4 },
  ],
  download: [
    { kind: "path", d: "M12 4V15" },
    { kind: "path", d: "M7 11L12 16L17 11" },
    { kind: "path", d: "M4 17V19C4 19.6 4.4 20 5 20H19C19.6 20 20 19.6 20 19V17" },
  ],
  upload: [
    { kind: "path", d: "M12 16V5" },
    { kind: "path", d: "M7 10L12 5L17 10" },
    { kind: "path", d: "M4 17V19C4 19.6 4.4 20 5 20H19C19.6 20 20 19.6 20 19V17" },
  ],
  copy: [
    { kind: "rect", x: 4, y: 4, width: 12, height: 12, rx: 2 },
    { kind: "rect", x: 8, y: 8, width: 12, height: 12, rx: 2 },
  ],
  pencil: [
    {
      kind: "path",
      d: "M16.5 3.5C17.3 2.7 18.7 2.7 19.5 3.5L20.5 4.5C21.3 5.3 21.3 6.7 20.5 7.5L8 20L3 21L4 16L16.5 3.5Z",
    },
    { kind: "path", d: "M14.5 5.5L18.5 9.5" },
  ],
  "fit-view": [
    { kind: "path", d: "M4 10V4H10" },
    { kind: "path", d: "M14 4H20V10" },
    { kind: "path", d: "M20 14V20H14" },
    { kind: "path", d: "M10 20H4V14" },
  ],
  "zoom-in": [
    { kind: "circle", cx: 10, cy: 10, r: 6 },
    { kind: "path", d: "M14.5 14.5L20 20" },
    { kind: "path", d: "M10 7V13" },
    { kind: "path", d: "M7 10H13" },
  ],
  "zoom-out": [
    { kind: "circle", cx: 10, cy: 10, r: 6 },
    { kind: "path", d: "M14.5 14.5L20 20" },
    { kind: "path", d: "M7 10H13" },
  ],
} as const satisfies Record<string, IconDefinition>
