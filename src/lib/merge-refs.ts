import type { Ref, RefCallback } from "react"

/**
 * Combines multiple refs (callback or object) into one callback ref, so a
 * component can keep its own internal ref for measurement while also
 * forwarding whatever ref its caller passed in — e.g. `SearchField` needs
 * `inputRef` internally for the `/` hotkey and the "clear" button, while
 * still forwarding the `ref` a parent (HoverPicker) attaches.
 */
export function mergeRefs<T>(...refs: ReadonlyArray<Ref<T> | undefined>): RefCallback<T> {
  return (value: T | null) => {
    for (const ref of refs) {
      if (typeof ref === "function") {
        ref(value)
      } else if (ref !== null && ref !== undefined) {
        ;(ref as { current: T | null }).current = value
      }
    }
  }
}
