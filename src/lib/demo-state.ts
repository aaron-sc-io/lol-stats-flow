/**
 * Visual-QA-only mechanism for the component gallery (`src/app/Gallery.tsx`).
 * Lets a static page render a control as if it were mid-`:hover` without
 * real pointer input, so the hover state DESIGN.md requires is visible
 * side by side with default/focus/disabled for screenshot review. Never
 * read by product code paths.
 *
 * ("Focus" doesn't need an equivalent: the gallery just calls real
 * `.focus()` on a mounted control via `AutoFocusSwatch`, which exercises
 * the genuine `:focus-visible` CSS path instead of faking it.)
 *
 * Components that accept `demoState` mirror their `:hover` CSS rule with a
 * `[data-demo-state="hover"]` attribute selector (see e.g.
 * `Button.module.css`) and spread `demoStateAttr(demoState)` onto their root
 * element.
 */
export type DemoState = "hover"

export function demoStateAttr(state: DemoState | undefined): { "data-demo-state"?: DemoState } {
  return state === undefined ? {} : { "data-demo-state": state }
}
