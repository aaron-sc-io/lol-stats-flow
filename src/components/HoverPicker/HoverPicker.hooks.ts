import { type RefObject, useEffect, useRef, useState } from "react"

const OPEN_INTENT_MS = 150
const CLOSE_GRACE_MS = 250

/**
 * Owns the open/closed boolean plus the hover-intent and leave-grace
 * timers. `onOpen`/`onClose` let the caller reset its own state (search
 * text, active index, measured position) without this hook knowing about
 * any of it.
 */
export function useHoverPickerOpenState(onOpen: () => void, onClose: () => void) {
  const [isOpen, setIsOpen] = useState(false)
  const openTimer = useRef<ReturnType<typeof setTimeout> | undefined>(undefined)
  const closeTimer = useRef<ReturnType<typeof setTimeout> | undefined>(undefined)

  function open() {
    window.clearTimeout(openTimer.current)
    window.clearTimeout(closeTimer.current)
    setIsOpen(true)
    onOpen()
  }

  function close() {
    window.clearTimeout(openTimer.current)
    window.clearTimeout(closeTimer.current)
    setIsOpen(false)
    onClose()
  }

  function scheduleOpen() {
    window.clearTimeout(closeTimer.current)
    if (!isOpen) {
      window.clearTimeout(openTimer.current)
      openTimer.current = setTimeout(open, OPEN_INTENT_MS)
    }
  }

  function scheduleClose() {
    window.clearTimeout(openTimer.current)
    window.clearTimeout(closeTimer.current)
    closeTimer.current = setTimeout(close, CLOSE_GRACE_MS)
  }

  useEffect(
    () => () => {
      window.clearTimeout(openTimer.current)
      window.clearTimeout(closeTimer.current)
    },
    [],
  )

  return {
    isOpen,
    open,
    close,
    scheduleOpen,
    scheduleClose,
    cancelScheduledClose: () => window.clearTimeout(closeTimer.current),
  }
}

/** Esc closes and returns focus to the trigger; "/" (re)focuses search;
 * a pointerdown outside both the trigger and the popover closes it. */
export function useDismissOnEscapeOrOutside(options: {
  readonly isOpen: boolean
  readonly triggerRef: RefObject<HTMLElement | null>
  readonly popoverRef: RefObject<HTMLElement | null>
  readonly searchInputRef: RefObject<HTMLInputElement | null>
  readonly onClose: () => void
}) {
  const { isOpen, triggerRef, popoverRef, searchInputRef, onClose } = options

  useEffect(() => {
    if (!isOpen) {
      return
    }
    function handleDocumentKeyDown(event: KeyboardEvent) {
      if (event.key === "Escape") {
        onClose()
        triggerRef.current?.focus()
      } else if (event.key === "/" && document.activeElement !== searchInputRef.current) {
        event.preventDefault()
        searchInputRef.current?.focus()
      }
    }
    function handleDocumentPointerDown(event: PointerEvent) {
      const target = event.target as Node
      const insidePopover = popoverRef.current?.contains(target) ?? false
      const insideTrigger = triggerRef.current?.contains(target) ?? false
      if (!insidePopover && !insideTrigger) {
        onClose()
      }
    }
    document.addEventListener("keydown", handleDocumentKeyDown)
    document.addEventListener("pointerdown", handleDocumentPointerDown)
    return () => {
      document.removeEventListener("keydown", handleDocumentKeyDown)
      document.removeEventListener("pointerdown", handleDocumentPointerDown)
    }
  }, [isOpen, triggerRef, popoverRef, searchInputRef, onClose])
}

// Excludes `tabindex="-1"` uniformly, including on otherwise-natively-
// focusable elements (`button`, `input`, ...): the roster/item grid uses
// roving tabindex (ARIA grid pattern — only the active cell is a real Tab
// stop; the rest are reachable by arrow keys instead), so a plain
// `button:not(:disabled)` clause would wrongly count every grid cell.
const FOCUSABLE_SELECTOR =
  'a[href]:not([tabindex="-1"]), button:not(:disabled):not([tabindex="-1"]), input:not(:disabled):not([tabindex="-1"]), select:not(:disabled):not([tabindex="-1"]), textarea:not(:disabled):not([tabindex="-1"]), [tabindex]:not([tabindex="-1"])'

function focusableElementsIn(container: HTMLElement): HTMLElement[] {
  const elements = Array.from(container.querySelectorAll<HTMLElement>(FOCUSABLE_SELECTOR))
  // `querySelectorAll` is spec-required to return matches in document order,
  // but a comma-separated selector list isn't always merge-sorted that way
  // in every engine — sorting explicitly by `compareDocumentPosition` makes
  // "first"/"last" correct regardless.
  return elements.sort((a, b) => {
    const position = a.compareDocumentPosition(b)
    if (position & Node.DOCUMENT_POSITION_FOLLOWING) {
      return -1
    }
    return position & Node.DOCUMENT_POSITION_PRECEDING ? 1 : 0
  })
}

/** Traps Tab/Shift+Tab inside the popover while it's open (DESIGN.md §7/§8:
 * the picker is a `role="dialog"` popover, so keyboard focus must stay
 * inside it rather than escaping into the rest of the canvas). Wrapping is
 * computed fresh on every Tab press (not cached) since the grid's
 * visible/focusable items change live as the user types into search or
 * toggles filters. */
export function useFocusTrap(popoverRef: RefObject<HTMLElement | null>, isOpen: boolean) {
  useEffect(() => {
    if (!isOpen) {
      return
    }
    function handleKeyDown(event: KeyboardEvent) {
      if (event.key !== "Tab") {
        return
      }
      const container = popoverRef.current
      if (container === null) {
        return
      }
      const focusable = focusableElementsIn(container)
      const first = focusable[0]
      const last = focusable.at(-1)
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
    return () => document.removeEventListener("keydown", handleKeyDown)
  }, [isOpen, popoverRef])
}
