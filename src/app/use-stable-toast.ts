import { useMemo, useRef } from "react"
import { useToast } from "@/components/Toast"
import type { ToastApi } from "@/persistence"

/**
 * `useToast()`'s returned object is a fresh `{ show }` literal on every
 * `ToastProvider` render (it shows toasts, so it re-renders often) — a
 * stable wrapper around it means `useEffect`s that depend on "the toast
 * API" (autosave's subscription, bootstrap's one-shot effect) don't tear
 * down and re-run every time an unrelated toast appears/dismisses.
 */
export function useStableToast(): ToastApi {
  const toast = useToast()
  const toastRef = useRef(toast)
  toastRef.current = toast
  return useMemo(() => ({ show: (options) => toastRef.current.show(options) }), [])
}
