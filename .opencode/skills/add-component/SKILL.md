---

name: add-component
description: Create or change a design-system primitive under src/components in lol-stats-flow (buttons, pickers, fields, badges, tooltips, icons). Use when adding a reusable UI component, adding an icon, or changing a primitive's states/styles.
---

# Add / change a design-system component

Read `src/components/AGENTS.md` and the relevant sections of `DESIGN.md` first.

1. Create `src/components/<Name>/`:
   - `<Name>.tsx`: export `<Name>` and `<Name>Props`. Forward refs if it wraps a native
     control. Put state in `data-*` attributes.
   - `<Name>.module.css`: tokens only. Cover default, hover, active, focus-visible and
     disabled. Add a `prefers-reduced-motion` guard for any transition.
   - `<Name>.test.tsx`: role, label, keyboard behavior and disabled behavior.
   - `index.ts`: `export { Name } from "./Name"` and `export type { NameProps } from "./Name"`.
2. Don't import from `@/graph`, `@/persistence`, `@/nodes`, `@/app` or `@/data`.
3. Icons go in `icons/icon-paths.<group>.ts` and are rendered through `<Icon>`.
4. Add or extend a gallery section in `src/app/gallery/` so the component appears at
   `?view=gallery`.
5. If you add a new token, put it in `src/styles/tokens.css` and document it in `DESIGN.md`
   §2 in the same change.
6. Run `just verify`, then `npm run test:e2e -- gallery`. An intentional visual change
   needs new Linux baselines from CI, so say so in the PR. Check it in the browser.
