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
