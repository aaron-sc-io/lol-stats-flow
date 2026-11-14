import { type RefObject, useEffect, useRef } from "react"

const FOCUSABLE_SELECTOR =
  'a[href], button:not([disabled]), textarea:not([disabled]), input:not([disabled]), select:not([disabled]), [tabindex]:not([tabindex="-1"])'

/**
 * Minimal focus trap for the drawer (plan D14 deliverable 3: "focus-
 * trapped, Esc closes"). Built locally rather than added to
 * `src/components/` — outside this phase's ownership; the plan's
 * ownership note says "if you need a new primitive, build it inside
 * src/app/" for exactly this situation.
 *
 * Mirrors `AddNodeMenu.tsx`'s existing pattern of depending on the
 * `active`/`isOpen` flag alone (`containerRef` is a stable ref object;
 * `onEscape`'s latest value is read through a ref instead of listed as a
 * dependency) so a parent re-render while the drawer is open never tears
 * down and re-runs the trap, which would otherwise fight the user's own
 * focus moves.
 */
export function useFocusTrap(
  containerRef: RefObject<HTMLElement | null>,
  active: boolean,
  onEscape: () => void,
): void {
  const onEscapeRef = useRef(onEscape)
  onEscapeRef.current = onEscape
  const triggerElementRef = useRef<HTMLElement | null>(null)

  // biome-ignore lint/correctness/useExhaustiveDependencies: containerRef is a stable ref object (same assumption AddNodeMenu.tsx's outside-click effect already makes) — only `active` should retrigger this effect.
  useEffect(() => {
    if (!active) {
      return
    }
    triggerElementRef.current = document.activeElement as HTMLElement | null
    const container = containerRef.current
    const firstFocusable = container?.querySelector<HTMLElement>(FOCUSABLE_SELECTOR)
    firstFocusable?.focus()

    function handleKeyDown(event: KeyboardEvent): void {
      if (event.key === "Escape") {
        event.preventDefault()
        onEscapeRef.current()
        return
      }
      if (event.key !== "Tab" || container === null || container === undefined) {
        return
      }
      const focusable = Array.from(container.querySelectorAll<HTMLElement>(FOCUSABLE_SELECTOR))
      const first = focusable[0]
      const last = focusable[focusable.length - 1]
      if (first === undefined || last === undefined) {
        return
      }
      if (event.shiftKey && document.activeElement === first) {
        event.preventDefault()
        last.focus()
      } else if (!event.shiftKey && document.activeElement === last) {
        event.preventDefault()
        first.focus()
      }
    }

    document.addEventListener("keydown", handleKeyDown)
    return () => {
      document.removeEventListener("keydown", handleKeyDown)
      triggerElementRef.current?.focus()
    }
  }, [active])
}
