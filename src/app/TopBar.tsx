import { useEffect, useRef, useState } from "react"
import { useStore } from "zustand"
import { EditableText } from "@/components/EditableText"
import { IconButton } from "@/components/IconButton"
import { useGraphStore } from "@/graph/store"
import {
  type ActiveCanvasMeta,
  renameCanvas,
  type SaveStatus,
  usePersistenceStore,
} from "@/persistence"
import { AddNodeMenu } from "./AddNodeMenu"
import styles from "./TopBar.module.css"

function isTypingTarget(element: Element | null): boolean {
  if (element === null) {
    return false
  }
  const tag = element.tagName
  return tag === "INPUT" || tag === "TEXTAREA" || (element as HTMLElement).isContentEditable
}

/** Ctrl/Cmd+Z, Ctrl/Cmd+Shift+Z, Ctrl+Y (DESIGN.md §8). Skips while focus
 * is inside a text field — a rename input or the drawer's search field —
 * so the browser's own text-undo still works there instead of the canvas
 * graph's. */
function useUndoRedoShortcuts(): void {
  useEffect(() => {
    function handleKeyDown(event: KeyboardEvent): void {
      if (!(event.ctrlKey || event.metaKey) || isTypingTarget(document.activeElement)) {
        return
      }
      const key = event.key.toLowerCase()
      if (key === "z" && !event.shiftKey) {
        event.preventDefault()
        useGraphStore.temporal.getState().undo()
      } else if ((key === "z" && event.shiftKey) || key === "y") {
        event.preventDefault()
        useGraphStore.temporal.getState().redo()
      }
    }
    document.addEventListener("keydown", handleKeyDown)
    return () => document.removeEventListener("keydown", handleKeyDown)
  }, [])
}

function UndoRedoControls() {
  useUndoRedoShortcuts()
  const canUndo = useStore(useGraphStore.temporal, (state) => state.pastStates.length > 0)
  const canRedo = useStore(useGraphStore.temporal, (state) => state.futureStates.length > 0)

  return (
    <>
      <IconButton
        icon="undo"
        aria-label="Undo"
        disabled={!canUndo}
        onClick={() => useGraphStore.temporal.getState().undo()}
      />
      <IconButton
        icon="redo"
        aria-label="Redo"
        disabled={!canRedo}
        onClick={() => useGraphStore.temporal.getState().redo()}
      />
    </>
  )
}

function CanvasNameField({ active }: { readonly active: ActiveCanvasMeta }) {
  const [draft, setDraft] = useState(active.name)
  const inputRef = useRef<HTMLInputElement>(null)

  useEffect(() => {
    setDraft(active.name)
  }, [active.name])

  function commit(): void {
    const trimmed = draft.trim()
    if (trimmed.length > 0 && trimmed !== active.name) {
      void renameCanvas(active.id, trimmed)
    } else {
      setDraft(active.name)
    }
  }

  return (
    <EditableText
      ref={inputRef}
      wrapperClassName={styles.nameField}
      value={draft}
      onChange={(event) => setDraft(event.target.value)}
      onBlur={commit}
      onKeyDown={(event) => {
        if (event.key === "Enter") {
          event.preventDefault()
          inputRef.current?.blur()
        } else if (event.key === "Escape") {
          event.preventDefault()
          setDraft(active.name)
          inputRef.current?.blur()
        }
      }}
      aria-label="Canvas name"
      size={Math.max(draft.length, 4)}
    />
  )
}

function SaveStatusLabel({ status }: { readonly status: SaveStatus }) {
  const text = status === "saving" ? "Saving…" : status === "error" ? "Save failed" : "Saved"
  return <span className={styles.saveStatus}>{text}</span>
}

export type TopBarProps = {
  readonly patchLabel: string
  readonly showAddNodeMenu: boolean
  readonly isGalleryView: boolean
  readonly onOpenDrawer: () => void
}

/**
 * Top bar (plan D14 deliverable 4): hamburger (opens the drawer), app
 * title (kept — `tests/e2e/canvas.spec.ts` asserts it), the active
 * canvas's editable name, add-node menu, undo/redo, save status, and the
 * patch label. The persistence chrome (name field, undo/redo, save
 * status) is hidden in the component gallery (`?view=gallery`, Phase 4's
 * visual showcase) the same way `AddNodeMenu` already is, and only
 * renders at all once persistence has bootstrapped — before that there's
 * no active canvas yet to name or a history to step through.
 */
export function TopBar({ patchLabel, showAddNodeMenu, isGalleryView, onOpenDrawer }: TopBarProps) {
  const bootstrapped = usePersistenceStore((state) => state.bootstrapped)
  const active = usePersistenceStore((state) => state.active)
  const saveStatus = usePersistenceStore((state) => state.saveStatus)
  const showPersistenceChrome = !isGalleryView && bootstrapped

  return (
    <header className={styles.topBar}>
      <div className={styles.topBarLeft}>
        <IconButton icon="menu" aria-label="Open menu" onClick={onOpenDrawer} />
        <span className={styles.title}>lol-stats-flow</span>
        {showPersistenceChrome ? <CanvasNameField active={active} /> : null}
        {showAddNodeMenu ? <AddNodeMenu /> : null}
        {showPersistenceChrome ? <UndoRedoControls /> : null}
      </div>
      <div className={styles.topBarRight}>
        {showPersistenceChrome ? <SaveStatusLabel status={saveStatus} /> : null}
        <span className={`${styles.patch} num`}>Patch {patchLabel}</span>
      </div>
    </header>
  )
}
