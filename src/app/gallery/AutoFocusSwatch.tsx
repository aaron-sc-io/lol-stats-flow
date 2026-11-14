import { type ReactNode, useEffect, useRef } from "react"

// Ordered by preference, not just "first in DOM": a NumberField's flanking
// stepper buttons would otherwise win over its own input (they're IconButtons
// with their own Tooltip, so focusing one pops an unrelated "Decrease" hint
// instead of showing what the swatch is actually demonstrating).
const FOCUS_TARGET_SELECTORS = [
  "input:not(:disabled)",
  "[role='slider']:not([aria-disabled='true'])",
  "button:not(:disabled)",
  "[tabindex]",
]

function findFocusTarget(root: HTMLElement): HTMLElement | null {
  for (const selector of FOCUS_TARGET_SELECTORS) {
    const match = root.querySelector<HTMLElement>(selector)
    if (match !== null) {
      return match
    }
  }
  return null
}

/**
 * Wraps a single primitive instance and moves real browser focus into its
 * most representative focusable element on mount — the gallery's "focus"
 * state swatch exercises the genuine `:focus-visible` CSS path instead of
 * faking it.
 */
export function AutoFocusSwatch({ children }: { readonly children: ReactNode }) {
  const ref = useRef<HTMLDivElement>(null)

  useEffect(() => {
    if (ref.current !== null) {
      findFocusTarget(ref.current)?.focus()
    }
  }, [])

  return <div ref={ref}>{children}</div>
}
