import { Button } from "@/components/Button"
import { useGraphStore } from "@/graph/store"
import { recalculatePatchPin, type ToastApi, usePersistenceStore } from "@/persistence"
import styles from "./PatchPinBanner.module.css"

export type PatchPinBannerProps = {
  readonly toast: ToastApi
}

/**
 * Quiet banner for the "pinned-available" patch-pin decision (plan D14
 * deliverable 2): the canvas is rendering against an older patch that's
 * still shipped, and "Recalculate" is the user's opt-in to move it onto
 * the current one (never automatic — only an unavailable pin migrates on
 * its own, silently, with a toast instead of this banner).
 */
export function PatchPinBanner({ toast }: PatchPinBannerProps) {
  const patchPin = usePersistenceStore((state) => state.patchPin)
  const active = usePersistenceStore((state) => state.active)

  if (patchPin.kind !== "pinned-available") {
    return null
  }
  const { pinnedPatch, currentPatch } = patchPin

  async function handleRecalculate(): Promise<void> {
    const { nodes, edges } = useGraphStore.getState()
    await recalculatePatchPin(active, pinnedPatch, nodes, edges, toast)
  }

  return (
    <div className={styles.banner} role="status">
      <span className={styles.text}>
        Built on patch {pinnedPatch} · Recalculate on {currentPatch}
      </span>
      <Button variant="ghost" className={styles.action} onClick={() => void handleRecalculate()}>
        Recalculate
      </Button>
    </div>
  )
}
