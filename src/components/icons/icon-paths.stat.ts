import type { IconDefinition } from "./icon-shape"

/**
 * Stat-category filter icons for the item shop (AD / AS / Crit / Lethality
 * /AP / Magic Pen / HP / Armor / MR / Ability Haste / Move Speed /
 * Lifesteal). Physical-stat icons use solid rings/lines; magic-stat icons
 * echo the same motif dashed or with the AP gem's diamond, so the pairing
 * reads as a consistent family at a glance — not color-coded (color stays
 * reserved for damage type per DESIGN.md §2.3).
 */
export const STAT_ICON_PATHS = {
  "stat-ad": [
    { kind: "path", d: "M6 18L17 7" },
    { kind: "path", d: "M9.9 11.9L12.1 14.1" },
    { kind: "circle", cx: 6, cy: 18, r: 1.1, filled: true },
  ],
  "stat-attack-speed": [
    { kind: "circle", cx: 12, cy: 13, r: 7 },
    { kind: "path", d: "M12 13V9" },
    { kind: "path", d: "M12 13L15.5 14.5" },
    { kind: "path", d: "M10 3H14" },
    { kind: "path", d: "M12 3V5" },
  ],
  "stat-crit": [
    { kind: "path", d: "M12 7L17 12L12 17L7 12Z" },
    { kind: "path", d: "M12 2V4" },
    { kind: "path", d: "M12 20V22" },
    { kind: "path", d: "M2 12H4" },
    { kind: "path", d: "M20 12H22" },
  ],
  "stat-lethality": [
    { kind: "circle", cx: 12, cy: 12, r: 6 },
    { kind: "path", d: "M3 12H21" },
    { kind: "path", d: "M17 8.5L21 12L17 15.5" },
  ],
  "stat-ap": [{ kind: "path", d: "M12 3L19 10L12 21L5 10Z" }],
  "stat-magic-pen": [
    { kind: "circle", cx: 12, cy: 12, r: 6, dashed: true },
    { kind: "path", d: "M3 12H21" },
    { kind: "path", d: "M17 8.5L21 12L17 15.5" },
  ],
  "stat-health": [
    { kind: "circle", cx: 8.5, cy: 9, r: 4 },
    { kind: "circle", cx: 15.5, cy: 9, r: 4 },
    { kind: "path", d: "M4.8 11.5L12 20L19.2 11.5" },
  ],
  "stat-armor": [
    { kind: "path", d: "M12 3L18 5.5V10C18 14.5 15.5 17.5 12 19C8.5 17.5 6 14.5 6 10V5.5Z" },
    { kind: "path", d: "M6.3 9H17.7" },
  ],
  "stat-magic-resist": [
    { kind: "path", d: "M12 3L18 5.5V10C18 14.5 15.5 17.5 12 19C8.5 17.5 6 14.5 6 10V5.5Z" },
    { kind: "path", d: "M12 8.3L14.7 11L12 13.7L9.3 11Z" },
  ],
  "stat-ability-haste": [
    { kind: "path", d: "M20 12A8 8 0 1 1 16.7 5.8" },
    { kind: "path", d: "M20 4V10H14" },
  ],
  "stat-move-speed": [
    { kind: "path", d: "M3 12H16" },
    { kind: "path", d: "M12 8L16 12L12 16" },
    { kind: "path", d: "M2 7.5H6.5" },
    { kind: "path", d: "M2 16.5H6.5" },
  ],
  "stat-lifesteal": [
    {
      kind: "path",
      d: "M12 3C12 3 5.5 11 5.5 15.5C5.5 18.5 8.5 21 12 21C15.5 21 18.5 18.5 18.5 15.5C18.5 11 12 3 12 3Z",
    },
  ],
} as const satisfies Record<string, IconDefinition>
