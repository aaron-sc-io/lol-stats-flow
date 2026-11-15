# lol-stats-flow — Design Principles

The reference for every UI decision in this repo. If a change conflicts with this document, change the document first (in the same PR) or change the code.

## 1. Principles

1. **Quiet chrome, loud data.** The interface is monochrome grey/black/white. The only color on screen is the meaning in the data (damage type).
2. **Hierarchy through luminance, weight and space.** Not through color, boxes, shadows or decoration.
3. **Nothing ships with a library's default look.** React Flow, Recharts, native inputs and scrollbars are all restyled to these tokens.
4. **Every interactive element has five states:** default, hover, active, focus-visible, disabled.
5. **Numbers are the product.** They are monospaced, tabular, right-aligned in tables, and never jump when they change.
6. **Forgiving, not confirming.** Destructive actions are undoable (toast with Undo), not guarded by modal dialogs.
7. **Reference quality bar:** Linear / Vercel dashboard density and restraint. No gradients, no glow, no emoji, no colored badges.

## 2. Tokens

All raw values live in `src/styles/tokens.css`. Components use the semantic aliases only. A lint rule rejects hex/rgb literals and raw px font sizes anywhere else.

### 2.1 Neutrals (slightly cool)

| Token | Value | Use |
|---|---|---|
| `--gray-0` | `#0A0A0B` | Canvas background |
| `--gray-1` | `#111113` | Node surface |
| `--gray-2` | `#18181B` | Raised surface, popovers |
| `--gray-3` | `#212125` | Hover fill, canvas grid dots |
| `--gray-4` | `#2A2A2F` | Default borders |
| `--gray-5` | `#3A3A40` | Strong borders, edges |
| `--gray-6` | `#5A5A63` | Disabled text/icons |
| `--gray-7` | `#85858F` | Tertiary text, labels |
| `--gray-8` | `#A9A9B2` | Secondary text |
| `--gray-9` | `#D4D4D8` | Emphasis on secondary surfaces |
| `--gray-10` | `#FAFAFA` | Primary text, accent, focus ring |

### 2.2 Semantic aliases

| Alias | Maps to |
|---|---|
| `--surface-canvas` / `--surface-node` / `--surface-raised` / `--surface-input` / `--surface-hover` | gray-0 / 1 / 2 / mix(2,3) / 3 |
| `--border-default` / `--border-strong` / `--border-focus` | gray-4 / 5 / 10 |
| `--text-primary` / `--text-secondary` / `--text-tertiary` / `--text-disabled` | gray-10 / 8 / 7 / 6 |
| `--accent` | gray-10 |

### 2.3 Color outside the neutrals

Only these. Data colors appear **only** in charts and damage-type indicators, never in buttons, borders, headers or other chrome.

| Token | Value | Meaning |
|---|---|---|
| `--dmg-physical` | `#D4877E` | Physical damage (muted red) |
| `--dmg-magic` | `#8DB3DF` | Magic damage (muted light blue) |
| `--dmg-true` | `var(--gray-10)` | True damage |
| `--danger` | `#C56B63` | Destructive actions and validation errors only |

Fill variants for bars and areas use the same hue at 72% opacity (`--dmg-*-fill`). Dimmed state (non-hovered series) uses 25% opacity.

## 3. Typography

- **Families:** `Geist Sans` for the interface, `Geist Mono` for every number. Both are self-hosted (no Google CDN, no flash of unstyled text).
- **Numbers:** `font-variant-numeric: tabular-nums`. Right-aligned in tables. Units in `--text-tertiary` after the value (`1,284 dmg`).
- **Weights:** 400 / 500 / 600 only.
- **Labels:** 11px, uppercase, `letter-spacing: 0.06em`, `--text-tertiary`.

| Token | Size / line height | Use |
|---|---|---|
| `--text-2xs` | 11 / 16 | Labels, captions |
| `--text-xs` | 12 / 16 | Secondary metadata, table cells |
| `--text-sm` | 13 / 20 | Default UI text |
| `--text-md` | 14 / 20 | Node titles, inputs |
| `--text-lg` | 16 / 24 | Section headings |
| `--text-xl` | 20 / 28 | Drawer headings |
| `--text-2xl` | 24 / 32 | Headline totals |

## 4. Space, shape, elevation

- **Spacing:** 4px base grid. Scale `4 / 8 / 12 / 16 / 24 / 32 / 48` (`--space-1` … `--space-7`).
- **Radii:** 4px for controls and icons, 8px for nodes and popovers.
- **Borders:** 1px hairlines separate surfaces. Shadows are not used for separation.
- **Elevation:** a single shadow, used only by popovers and the drawer: `0 8px 24px rgb(0 0 0 / 0.5)`.
- **Icons:** 16 / 20 / 24. Portraits and item icons have a 1px inner border (`--border-default`) and 4px radius.
- **Node scaling:** the Champion node resizes with a locked aspect ratio. All internal sizes are expressed as `calc(<token> * var(--node-scale))`, where `--node-scale = nodeWidth / baseWidth`.

## 5. Motion

| Token | Duration | Use |
|---|---|---|
| `--motion-fast` | 120ms | Hover, press |
| `--motion-base` | 180ms | Popover open, collapse/expand |
| `--motion-data` | 200ms | Chart and value tweens |

Easing: `cubic-bezier(0.2, 0, 0, 1)`. Under `prefers-reduced-motion: reduce`, all transitions and tweens become instant.

## 6. Data visualization

- **Damage type** is encoded by color, plus shape as a redundant cue for color-blind users and greyscale prints:

  | Type | Color | Shape cue |
  |---|---|---|
  | Physical | `--dmg-physical` | Solid fill |
  | Magic | `--dmg-magic` | Fill + diagonal hatch |
  | True | `--dmg-true` | Outline only |

- **Bars** stack by damage type within each step or tick.
- **Lines:** each segment takes the color of the damage type dealt in that step or tick. Mixed steps use the dominant type, and the tooltip shows the full breakdown.
- **Combo series** are distinguished by stroke pattern (solid / dashed / dotted) × marker shape (circle / square / diamond), plus a direct label at the end of the line. Color is reserved for damage type. This gives 9 distinct series before cycling; the legend always shows the encoding.
- **Hover:** the hovered series stays at full opacity. Everything else dims to 25%. The upstream node path (Combo → item set → Champion and their edges) is highlighted at the same time.
- **Axes and grid:** `--gray-4` gridlines (1px, horizontal only), `--text-tertiary` tick labels in Geist Mono, no chart border.
- **Tooltips:** custom component on `--surface-raised`, showing per instance: source, raw → mitigated value, damage type, target HP after.
- **The same damage-type encoding is used everywhere:** chart, comparison table chips, combo timeline entries, tooltips.

## 7. Components and library overrides

- **React Flow:**
  - Canvas: dot grid in `--gray-3` (1px dots, 24px gap).
  - Edges: 1.5px smoothstep in `--border-strong`; animated dash only while highlighted.
  - Handles: 8px rings that fill on hover or connect.
  - Controls and MiniMap fully restyled; attribution placed per license.
- **HoverPicker** (roster picker, item shop):
  - Opens after a 150ms hover intent and closes after a 250ms leave grace.
  - Search field at the top, then a row of icon filter buttons, each with a text tooltip.
  - Disabled entries are greyed with a "not modeled" badge and `aria-disabled`.
- **Inputs:** custom range slider, number steppers, and a headless listbox in place of native `<select>`. Themed thin scrollbars.
- **Champion source badges** in combos are monogram chips (champion initials) plus the series stroke pattern, not a color.
- **Empty states:** one line of guidance and one action. Example: "Connect an item set to start a combo."

## 8. Interaction and accessibility

- Click targets are at least 28px (at least 24px at minimum node scale).
- **Keyboard:**
  - Logical Tab order inside nodes.
  - `/` focuses the open picker's search, and `Esc` closes it.
  - `Delete` removes the selected combo step.
  - `Ctrl+Z` / `Ctrl+Shift+Z` for undo / redo.
- **Focus:** a 1px `--border-focus` ring with a 2px `--surface-canvas` offset, shown on `:focus-visible` only.
- **Contrast:** WCAG 2.2 AA for all text; secondary text is at least 4.5:1 on its surface.
- **CI enforcement:**
  - `@axe-core/playwright` must report zero serious or critical violations on the default canvas and on open pickers.
  - Token lint must pass.
  - Screenshot baselines are kept at 100% and 200% DPR.

## 9. Don'ts

- No default React Flow or Recharts styling.
- No gradients, glows, neon, or colored chrome.
- No data colors outside data contexts.
- No modal confirmation for undoable actions.
- No proportional (non-tabular) digits in any number that updates live.
- No font sizes, colors or spacing outside the tokens.
