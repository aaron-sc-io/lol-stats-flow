import { createContext, type ReactNode, useContext, useEffect, useState } from "react"
import { createPortal } from "react-dom"
import { IconButton } from "@/components/IconButton"
import styles from "./Toast.module.css"

const DEFAULT_DURATION_MS = 5000

export type ToastOptions = {
  readonly message: string
  readonly actionLabel?: string | undefined
  readonly onAction?: (() => void) | undefined
  readonly durationMs?: number | undefined
}

type ToastRecord = {
  readonly id: string
  readonly message: string
  readonly actionLabel?: string | undefined
  readonly onAction?: (() => void) | undefined
  readonly durationMs: number
}

type ToastContextValue = {
  readonly show: (options: ToastOptions) => void
}

const ToastContext = createContext<ToastContextValue | null>(null)

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

  function dismiss(id: string) {
    setToasts((current) => current.filter((toast) => toast.id !== id))
  }

  function show(options: ToastOptions) {
    const record: ToastRecord = {
      id: crypto.randomUUID(),
      message: options.message,
      actionLabel: options.actionLabel,
      onAction: options.onAction,
      durationMs: options.durationMs ?? DEFAULT_DURATION_MS,
    }
    setToasts((current) => [...current, record])
  }

  return (
    <ToastContext.Provider value={{ show }}>
      {children}
      {createPortal(
        <section className={styles.viewport} aria-label="Notifications">
          {toasts.map((toast) => (
            <ToastItem key={toast.id} toast={toast} onDismiss={() => dismiss(toast.id)} />
          ))}
        </section>,
        document.body,
      )}
    </ToastContext.Provider>
  )
}

function ToastItem({
  toast,
  onDismiss,
}: {
  readonly toast: ToastRecord
  readonly onDismiss: () => void
}) {
  useEffect(() => {
    const timer = setTimeout(onDismiss, toast.durationMs)
    return () => clearTimeout(timer)
  }, [toast.durationMs, onDismiss])

  return (
    <div className={styles.toast} role="status">
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
      <IconButton icon="close" aria-label="Dismiss" size={24} onClick={onDismiss} />
    </div>
  )
}
