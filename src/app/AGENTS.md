# src/app - rules

App shell: `App.tsx` (React Flow canvas, `NODE_TYPES`), `TopBar` (undo/redo, add node,
fit view), `Drawer` (canvases, import/export, share link), `PatchPinBanner`,
`AddNodeMenu`, and the component gallery (`Gallery.tsx` + `gallery/`, served at
`?view=gallery`).

- The shell wires state and persistence together; domain logic belongs in `src/graph` or
  `src/persistence`.
- Keyboard: Ctrl+Z / Ctrl+Shift+Z / Ctrl+Y, Esc closes, `/` focuses picker search. Keep
  the drawer's focus trap (`use-focus-trap.ts`).
- Destructive actions are undoable through a toast, never a confirm dialog (DESIGN.md §1.6).
- The gallery is a living style guide with visual baselines. When a component changes,
  update its section in the same change.
