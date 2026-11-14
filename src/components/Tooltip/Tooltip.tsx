import {
  type ComponentPropsWithRef,
  cloneElement,
  type ReactElement,
  useCallback,
  useEffect,
  useId,
  useLayoutEffect,
  useRef,
  useState,
} from "react"
import { createPortal } from "react-dom"
import { cx } from "@/lib/cx"
import { computeFloatingPosition, type Placement } from "@/lib/floating-position"
import styles from "./Tooltip.module.css"

const OPEN_DELAY_MS = 400

export type TooltipProps = {
  readonly label: string
  /** A single `<button>` element — Tooltip attaches its own ref and hover/
   * focus handlers directly, so the child must not define its own. */
  readonly children: ReactElement<ComponentPropsWithRef<"button">>
  readonly placement?: Placement
}

export function Tooltip({ label, children, placement = "bottom" }: TooltipProps) {
  const tooltipId = useId()
  const [isVisible, setIsVisible] = useState(false)
  const [position, setPosition] = useState<{ readonly top: number; readonly left: number } | null>(
    null,
  )
  const triggerRef = useRef<HTMLButtonElement>(null)
  const tooltipRef = useRef<HTMLDivElement>(null)
  const openTimer = useRef<ReturnType<typeof setTimeout> | undefined>(undefined)

  function scheduleOpen() {
    window.clearTimeout(openTimer.current)
    openTimer.current = setTimeout(() => setIsVisible(true), OPEN_DELAY_MS)
  }

  const close = useCallback(() => {
    window.clearTimeout(openTimer.current)
    setIsVisible(false)
    setPosition(null)
  }, [])

  useEffect(() => () => window.clearTimeout(openTimer.current), [])

  useLayoutEffect(() => {
    if (!isVisible) {
      return
    }
    const trigger = triggerRef.current
    const tooltip = tooltipRef.current
    if (trigger === null || tooltip === null) {
      return
    }
    const triggerRect = trigger.getBoundingClientRect()
    const tooltipRect = tooltip.getBoundingClientRect()
    setPosition(
      computeFloatingPosition({
        trigger: triggerRect,
        floating: { width: tooltipRect.width, height: tooltipRect.height },
        placement,
        viewport: { width: window.innerWidth, height: window.innerHeight },
        gap: 6,
      }),
    )
  }, [isVisible, placement])

  useEffect(() => {
    if (!isVisible) {
      return
    }
    function handleKeyDown(event: KeyboardEvent) {
      if (event.key === "Escape") {
        close()
      }
    }
    // The tooltip is `position: fixed` and only ever measured once, on
    // open — it doesn't track the trigger during a scroll. Dismissing
    // instead of repositioning matches Esc: any disruption just closes it.
    document.addEventListener("keydown", handleKeyDown)
    document.addEventListener("scroll", close, { capture: true, passive: true })
    return () => {
      document.removeEventListener("keydown", handleKeyDown)
      document.removeEventListener("scroll", close, { capture: true })
    }
  }, [isVisible, close])

  const trigger = cloneElement(children, {
    ref: triggerRef,
    onPointerEnter: scheduleOpen,
    onPointerLeave: close,
    onFocus: scheduleOpen,
    onBlur: close,
    "aria-describedby": isVisible ? tooltipId : undefined,
  })

  return (
    <>
      {trigger}
      {isVisible
        ? createPortal(
            <div
              id={tooltipId}
              ref={tooltipRef}
              role="tooltip"
              className={cx(styles.tooltip, position === null && styles.measuring)}
              style={position === null ? undefined : { top: position.top, left: position.left }}
            >
              {label}
            </div>,
            document.body,
          )
        : null}
    </>
  )
}
