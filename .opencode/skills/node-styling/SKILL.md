---

name: node-styling
description: Styling and layout rules for lol-stats-flow canvas nodes (Champion, Combo, Graph, and any new node type built on NodeFrame). Use whenever adding or changing a node's layout, CSS module, resize behavior, tables, charts, scroll regions, or view/tab switching inside a node — especially to prevent content overflowing the node frame when it is resized.
---

# Node styling (lol-stats-flow)

Source of truth for tokens and visual language is `DESIGN.md`. This skill covers
**how node internals are laid out** so they survive resizing. Reference
implementation: `src/nodes/GraphNode/GraphNode.tsx` + `GraphNode.module.css`.

## 1. Shell: always `NodeFrame`

- Every node renders inside `<NodeFrame>` (`src/components/NodeFrame`). Never
  re-implement header, border, delete badge, or resize brackets.
- Pass `width` and, only when the user has height-resized, `style={{ height }}`.
  Read both from `useInternalNode(id)` (`.width` / `.height`), not
  `NodeProps.width` — the internal record is only set by a real user resize.
- Sizes are view state; never persist them in node `data`.
- `NodeFrame`'s `.body` is `flex: 1 1 auto; min-height: 0` — the elastic area.

## 2. Body layout contract

Inner wrapper (e.g. `.body` in the node's module):

```css
.body {
  display: flex;
  flex-direction: column;
  gap: var(--space-4);
  height: 100%;
}
```

Split children into two kinds:

| Region                    | Behavior                                                           | Examples                                           |
| ------------------------- | ------------------------------------------------------------------ | -------------------------------------------------- |
| **Fixed**                 | Natural height, never shrinks                                      | targets panel, controls row, chart region, sliders |
| **Elastic** (exactly one) | `flex: 1 1 auto; min-height: 0; overflow: auto;` + `nowheel` class | tables, long lists                                 |

Rules:

1. **Every table / unbounded list goes in the elastic region.** Never render a
   table inside a fixed region (e.g. under a chart in the same component) — it
   will spill out of a height-resized frame. If a component owns both a chart and
   a table, split it into two exports and lift shared state (e.g. a cursor value)
   into the node.
2. Every view/tab of a node must route its table into the **same** elastic
   region. Switching tabs must not move tables into fixed regions.
3. Wide content scrolls sideways inside the elastic region; tables use
   `white-space: nowrap` cells and `th { position: sticky; top: 0 }` with
   `background-color: var(--surface-node)`.
4. Horizontal rows of cards (`overflow-x: auto`) need top/right padding so
   corner delete badges aren't clipped.
5. Any flex child that holds text or charts needs `min-width: 0`.

## 3. Minimum height

The node may shrink until only `MIN_TABLE_HEIGHT` (96) of the elastic region
remains — never into fixed content. Measure in a `useLayoutEffect` with a
`ResizeObserver`:

```ts
const overflow = Math.max(0, body.scrollHeight - body.clientHeight)
setMinHeight(
  frame.offsetHeight -
    region.offsetHeight +
    overflow +
    Math.min(region.scrollHeight, MIN_TABLE_HEIGHT),
)
```

- Observe the frame, the elastic region, **and every body child** — view
  switches resize fixed children while the frame height stays fixed.
- Include `overflow`: `offsetHeight` can't see content already spilling past a
  too-short fixed height.
- Pass `minHeight` to `NodeFrame`'s `resize` config, and grow the node when it
  falls below the minimum (e.g. after switching tabs):

```ts
useLayoutEffect(() => {
  if (nodeHeight !== undefined && nodeHeight < minHeight) updateNode(id, { height: minHeight })
}, [id, nodeHeight, minHeight, updateNode])
```

## 4. Charts

- Chart height is local state, adjusted via `ChartResizeHandle` (bottom-right
  grip, `position: absolute` in a `position: relative` `.chartRegion`). Resizing
  the chart adds the same delta to a height-resized node so the elastic region
  keeps its room; width is clamped to the node's `MIN_WIDTH`/`MAX_WIDTH`.
- Recharts goes in `<ResponsiveContainer width="100%" height={chartHeight}>`;
  interactive charts get `className="nodrag nowheel"`.
- Tooltips/popovers that must escape the node use `position: fixed` portals
  (`z-index: 1000`), not overflow-visible ancestors.

## 5. Interaction classes

- `nodrag` on anything clickable/draggable inside the node (controls, selects,
  sliders, chart surfaces, resize grips).
- `nowheel` on anything that scrolls (elastic region, horizontal lists, charts)
  so wheel events scroll content instead of zooming the canvas.

## 6. CSS conventions

- CSS Modules per node (`<Node>.module.css`), combined with `cx()` from `@/lib/cx`.
- Only design tokens from `src/styles/tokens.css` (`var(--space-*)`,
  `--font-size-*`, `--surface-*`, `--border-*`, `--text-*`, `--radius-*`,
  `--motion-*`). No raw colors or px font sizes — `npm run lint:tokens` fails on them.
- Small labels: `--font-size-2xs`, uppercase, `--label-letter-spacing`,
  `--text-tertiary`. Numbers: `num` class (tabular, right-aligned in tables).
- State via data attributes (`data-selected`, `data-dimmed`, `data-pinned`),
  not extra class permutations. Respect `prefers-reduced-motion`.

## 7. Verify a layout change

1. `npm run typecheck`, `npx biome check <files>`, `npx vitest run src/nodes/<Node>`.
2. In the browser: resize the node with the corner brackets to its minimum in
   **every view/tab**, switch tabs while small, and resize narrow — nothing may
   render outside the frame border; tables must scroll.
