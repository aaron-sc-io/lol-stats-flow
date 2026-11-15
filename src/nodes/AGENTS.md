# src/nodes - rules

React Flow node types: `ChampionNode`, `ComboNode`, `GraphNode`, `TutorialNode`, registered in
`src/app/App.tsx` `NODE_TYPES`.

- `TutorialNode` exists only on the "Tutorial" canvas (`createTutorialCanvas` in
  `src/graph/default-canvas.ts`, which first-run users land on and the drawer's
  "Open tutorial" recreates). It is deliberately absent from the Add Node menu. Its copy
  lives in `TutorialNode/tutorial-steps.ts`; update it when a described feature changes.

- Every node renders inside `NodeFrame`. Layout and resize rules are in the
  [`node-styling`](../../.opencode/skills/node-styling/SKILL.md) skill; read it before
  touching any node CSS or layout.
- Nodes read canonical state from the graph store and derived numbers from `src/graph`
  selectors and caches. Never compute damage in a component, and never put derived
  numbers into node `data`.
- Node size is view state from `useInternalNode`; it is never persisted.
- Folder layout: `<Node>/<Node>.tsx`, `<Node>.module.css`, `<Node>.test.tsx`, `index.ts`,
  plus sub-components in the same folder.
- `nodrag` on interactive elements, `nowheel` on scroll regions and charts.
- Adding a new node type: [`add-node-type`](../../.opencode/skills/add-node-type/SKILL.md).
- Visual changes: update e2e specs in `tests/e2e/` and check in a browser. Linux
  screenshot baselines come from CI; don't hand-edit them.
