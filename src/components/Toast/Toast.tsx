import { createContext, type ReactNode, useCallback, useContext, useEffect, useState } from "react"
import { createPortal } from "react-dom"
import { IconButton } from "@/components/IconButton"
import { cx } from "@/lib/cx"
import styles from "./Toast.module.css"

const DEFAULT_DURATION_MS = 5000
export const MAX_VISIBLE_TOASTS = 5
export const EXIT_DURATION_MS = 180

export type ToastTone = "default" | "error"

export type ToastOptions = {
  readonly message: string
  readonly tone?: ToastTone | undefined
  readonly actionLabel?: string | undefined
  readonly onAction?: (() => void) | undefined
  readonly durationMs?: number | undefined
}

type ToastRecord = {
  readonly id: string
  readonly message: string
  readonly tone: ToastTone
  readonly actionLabel?: string | undefined
  readonly onAction?: (() => void) | undefined
  readonly durationMs: number
  readonly exiting: boolean
}

type ToastContextValue = {
  readonly show: (options: ToastOptions) => void
  /** Registers the element toasts render inside (falls back to body). */
  readonly setContainer: (element: HTMLElement | null) => void
}

const ToastContext = createContext<ToastContextValue | null>(null)

function prefersReducedMotion(): boolean {
  return (
    typeof window !== "undefined" &&
    typeof window.matchMedia === "function" &&
    window.matchMedia("(prefers-reduced-motion: reduce)").matches
  )
}

/** Reads the nearest `<ToastProvider>`. Throws — rather than silently
 * no-opping — if rendered outside one, since a toast that never shows is a
 * much harder bug to track down than a boundary error at mount time. */
export function useToast(): ToastContextValue {
  const context = useContext(ToastContext)
  if (context === null) {
    throw new Error("useToast must be used within a <ToastProvider>")
  }
  return context
}

/**
 * Mount once near the app root. DESIGN.md §1.6: destructive actions are
 * undoable via a toast action instead of a confirm dialog — `show({
 * message, actionLabel: "Undo", onAction })` is the whole contract.
 */
export function ToastProvider({ children }: { readonly children: ReactNode }) {
  const [toasts, setToasts] = useState<readonly ToastRecord[]>([])
  const [container, setContainer] = useState<HTMLElement | null>(null)

  const remove = useCallback((id: string) => {
    setToasts((current) => current.filter((toast) => toast.id !== id))
  }, [])

  const dismiss = useCallback(
    (id: string) => {
      if (prefersReducedMotion()) {
        remove(id)
        return
      }
      setToasts((current) =>
        current.map((toast) => (toast.id === id ? { ...toast, exiting: true } : toast)),
      )
    },
    [remove],
  )

  const show = useCallback((options: ToastOptions) => {
    const record: ToastRecord = {
      id: crypto.randomUUID(),
      message: options.message,
      tone: options.tone ?? "default",
      actionLabel: options.actionLabel,
      onAction: options.onAction,
      durationMs: options.durationMs ?? DEFAULT_DURATION_MS,
      exiting: false,
    }
    setToasts((current) => {
      const next = [...current, record]
      return next.length > MAX_VISIBLE_TOASTS ? next.slice(next.length - MAX_VISIBLE_TOASTS) : next
    })
  }, [])

  return (
    <ToastContext.Provider value={{ show, setContainer }}>
      {children}
      {createPortal(
        <section
          className={cx(styles.viewport, container !== null && styles.contained)}
          aria-label="Notifications"
        >
          {toasts.map((toast) => (
            <ToastItem
              key={toast.id}
              toast={toast}
              onDismiss={() => dismiss(toast.id)}
              onRemove={() => remove(toast.id)}
            />
          ))}
        </section>,
        container ?? document.body,
      )}
    </ToastContext.Provider>
  )
}

function ToastItem({
  toast,
  onDismiss,
  onRemove,
}: {
  readonly toast: ToastRecord
  readonly onDismiss: () => void
  readonly onRemove: () => void
}) {
  useEffect(() => {
    if (toast.exiting) {
      return
    }
    const timer = setTimeout(onDismiss, toast.durationMs)
    return () => clearTimeout(timer)
  }, [toast.durationMs, toast.exiting, onDismiss])

  useEffect(() => {
    if (!toast.exiting) {
      return
    }
    const timer = setTimeout(onRemove, EXIT_DURATION_MS)
    return () => clearTimeout(timer)
  }, [toast.exiting, onRemove])

  return (
    <div
      className={cx(
        styles.toast,
        toast.tone === "error" && styles.error,
        toast.exiting ? styles.exiting : styles.entering,
      )}
      role="status"
      data-tone={toast.tone}
      data-state={toast.exiting ? "exiting" : "open"}
      onAnimationEnd={() => {
        if (toast.exiting) {
          onRemove()
        }
      }}
    >
      <span className={styles.message}>{toast.message}</span>
      {toast.actionLabel === undefined ? null : (
        <button
          type="button"
          className={styles.action}
          onClick={() => {
            toast.onAction?.()
            onDismiss()
          }}
        >
          {toast.actionLabel}
        </button>
      )}
      <IconButton icon="close" aria-label="Dismiss" size={20} onClick={onDismiss} />
    </div>
  )
}
