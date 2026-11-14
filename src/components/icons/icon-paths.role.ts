import type { IconDefinition } from "./icon-shape"

/**
 * Role filter icons for the champion roster picker (Top/Jungle/Mid/Bottom
 * aka ADC/Support). Original minimalist glyphs — not Riot's role badges.
 */
export const ROLE_ICON_PATHS = {
  "role-top": [
    { kind: "path", d: "M12 3V15" },
    { kind: "path", d: "M8 7H16" },
    { kind: "path", d: "M12 15V20" },
    { kind: "circle", cx: 12, cy: 21, r: 1, filled: true },
  ],
  "role-jungle": [
    { kind: "path", d: "M12 3L21 12L12 21L3 12Z" },
    { kind: "circle", cx: 12, cy: 12, r: 1.4, filled: true },
  ],
  "role-mid": [
    {
      kind: "path",
      d: "M12 3L13.3 10.7L21 12L13.3 13.3L12 21L10.7 13.3L3 12L10.7 10.7Z",
      filled: true,
    },
  ],
  "role-bottom": [
    { kind: "circle", cx: 12, cy: 12, r: 7 },
    { kind: "path", d: "M12 2V6" },
    { kind: "path", d: "M12 18V22" },
    { kind: "path", d: "M2 12H6" },
    { kind: "path", d: "M18 12H22" },
    { kind: "circle", cx: 12, cy: 12, r: 1, filled: true },
  ],
  "role-support": [{ kind: "path", d: "M12 3L19 6V11C19 16 16 19.5 12 21C8 19.5 5 16 5 11V6Z" }],
} as const satisfies Record<string, IconDefinition>
