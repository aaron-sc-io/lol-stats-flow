import { type RefObject, useEffect, useRef } from "react"

const FOCUSABLE_SELECTOR =
  'a[href], button:not([disabled]), textarea:not([disabled]), input:not([disabled]), select:not([disabled]), [tabindex]:not([tabindex="-1"])'

export type FocusTrapOptions = {
  readonly containerRef: RefObject<HTMLElement | null>
  readonly active: boolean
  readonly onEscape: () => void
  /** Focused once the trap activates, instead of the first focusable
   * element in DOM order. Lets the caller send initial focus somewhere
   * deliberate — e.g. the drawer's search field — instead of whichever
   * icon button happens to render first, whose tooltip would otherwise
   * open from this purely programmatic focus (tooltips must only ever
   * appear from hover or real keyboard navigation). Falls back to the
   * first focusable element when unset or not yet mounted. */
  readonly initialFocusRef?: RefObject<HTMLElement | null>
}

/**
 * Minimal focus trap for the drawer (plan D14 deliverable 3: "focus-
 * trapped, Esc closes"). Built locally rather than added to
 * `src/components/` — outside this phase's ownership; the plan's
 * ownership note says "if you need a new primitive, build it inside
 * src/app/" for exactly this situation.
 *
 * Mirrors `AddNodeMenu.tsx`'s existing pattern of depending on the
 * `active`/`isOpen` flag alone (`containerRef`/`initialFocusRef` are
 * stable ref objects; `onEscape`'s latest value is read through a ref
 * instead of listed as a dependency) so a parent re-render while the
 * drawer is open never tears down and re-runs the trap, which would
 * otherwise fight the user's own focus moves.
 */
export function useFocusTrap({
  containerRef,
  active,
  onEscape,
  initialFocusRef,
}: FocusTrapOptions): void {
  const onEscapeRef = useRef(onEscape)
  onEscapeRef.current = onEscape
  const triggerElementRef = useRef<HTMLElement | null>(null)

  // biome-ignore lint/correctness/useExhaustiveDependencies: containerRef/initialFocusRef are stable ref objects (same assumption AddNodeMenu.tsx's outside-click effect already makes) — only `active` should retrigger this effect.
  useEffect(() => {
    if (!active) {
      return
    }
    triggerElementRef.current = document.activeElement as HTMLElement | null
    const container = containerRef.current
    const initialTarget =
      initialFocusRef?.current ?? container?.querySelector<HTMLElement>(FOCUSABLE_SELECTOR)
    initialTarget?.focus()

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
