import type { IconDefinition } from "./icon-shape"

/**
 * Champion class filter icons for the roster picker — Riot's six client
 * champion-select categories (Fighter/Tank/Mage/Assassin/Marksman/Support).
 * Original minimalist glyphs — not Riot's class badges.
 */
export const CLASS_ICON_PATHS = {
  "class-fighter": [
    { kind: "path", d: "M5 19L19 5" },
    { kind: "path", d: "M19 19L5 5" },
    { kind: "path", d: "M6 14L10 18" },
    { kind: "path", d: "M14 18L18 14" },
  ],
  "class-tank": [
    { kind: "path", d: "M5 20V11A7 7 0 0 1 19 11V20Z" },
    { kind: "path", d: "M5 13H19" },
    { kind: "path", d: "M12 13V20" },
  ],
  "class-mage": [
    { kind: "path", d: "M4 20L13 11" },
    { kind: "path", d: "M17 3V11" },
    { kind: "path", d: "M13 7H21" },
  ],
  "class-assassin": [
    { kind: "path", d: "M12 3L14.5 13H9.5Z" },
    { kind: "path", d: "M7 13H17" },
    { kind: "path", d: "M12 13V19" },
    { kind: "circle", cx: 12, cy: 20.5, r: 1, filled: true },
  ],
  "class-marksman": [
    { kind: "path", d: "M7 3C14 6 14 18 7 21" },
    { kind: "path", d: "M7 3V21" },
    { kind: "path", d: "M3 12H20" },
    { kind: "path", d: "M17 9L20 12L17 15" },
  ],
  "class-support": [
    {
      kind: "path",
      d: "M12 20C7 16 3 13 3 8.5A4.5 4.5 0 0 1 12 6A4.5 4.5 0 0 1 21 8.5C21 13 17 16 12 20Z",
    },
  ],
} as const satisfies Record<string, IconDefinition>
