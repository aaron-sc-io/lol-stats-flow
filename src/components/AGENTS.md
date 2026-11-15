# src/components - rules

App-agnostic design-system primitives. Visual source of truth: [DESIGN.md](../../DESIGN.md).

- Don't import from `@/graph`, `@/persistence`, `@/nodes`, `@/app` or `@/data`.
  Components get data through props.
- One folder per component: `Name/Name.tsx`, `Name.module.css`, `Name.test.tsx`,
  `index.ts` (re-exports the component and its `NameProps` type).
- Tokens only (`var(--…)` from `src/styles/tokens.css`); `npm run lint:tokens` enforces it.
- Every interactive element has default, hover, active, focus-visible and disabled states,
  and respects `prefers-reduced-motion`. State goes in `data-*` attributes.
- Accessibility is tested: roles and labels in unit tests, axe in e2e.
- Every new or changed primitive gets a swatch in the gallery (`src/app/gallery/`,
  served at `?view=gallery`), which is covered by `tests/e2e/gallery.spec.ts`.
- Icons: add paths to `icons/icon-paths.*.ts`; don't inline SVG in components.

Playbook: [`add-component`](../../.opencode/skills/add-component/SKILL.md).
