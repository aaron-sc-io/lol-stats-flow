import { type ChangeEvent, useEffect, useMemo, useRef, useState } from "react"
import { createPortal } from "react-dom"
import { Button } from "@/components/Button"
import { IconButton } from "@/components/IconButton"
import { Icon } from "@/components/icons"
import { SearchField } from "@/components/SearchField"
import { useToast } from "@/components/Toast"
import {
  copyShareLink,
  createNewCanvas,
  deleteCanvasWithUndo,
  duplicateCanvas,
  exportActiveCanvasAsJson,
  importCanvasFromJson,
  listCanvasSummaries,
  openSavedCanvas,
  renameCanvas,
  usePersistenceStore,
} from "@/persistence"
import styles from "./Drawer.module.css"
import { DrawerRow } from "./DrawerRow"
import { useFocusTrap } from "./use-focus-trap"

export type DrawerProps = {
  readonly isOpen: boolean
  readonly onClose: () => void
  readonly effectivePatch: string
}

/**
 * Left hamburger drawer (plan D14 deliverable 3): canvas list with
 * search, per-row open/rename/duplicate/delete, "New canvas", and a
 * footer for import/export/share-link/patch. 320px, focus-trapped, Esc
 * closes, portal-rendered (consistent with Toast/Listbox) so it overlays
 * the canvas with the one elevation shadow (DESIGN.md §4) instead of
 * being clipped by any ancestor.
 */
export function Drawer({ isOpen, onClose, effectivePatch }: DrawerProps) {
  const panelRef = useRef<HTMLDivElement>(null)
  const searchInputRef = useRef<HTMLInputElement>(null)
  const fileInputRef = useRef<HTMLInputElement>(null)
  const [query, setQuery] = useState("")
  const [summaries, setSummaries] = useState(() => listCanvasSummaries())
  const activeId = usePersistenceStore((state) => state.active.id)
  const toast = useToast()

  useFocusTrap({
    containerRef: panelRef,
    active: isOpen,
    onEscape: onClose,
    initialFocusRef: searchInputRef,
  })

  useEffect(() => {
    if (isOpen) {
      setSummaries(listCanvasSummaries())
    }
  }, [isOpen])

  const filtered = useMemo(() => {
    const needle = query.trim().toLowerCase()
    if (needle.length === 0) {
      return summaries
    }
    return summaries.filter((summary) => summary.name.toLowerCase().includes(needle))
  }, [summaries, query])

  function refresh(): void {
    setSummaries(listCanvasSummaries())
  }

  async function handleOpen(id: string): Promise<void> {
    await openSavedCanvas(id, toast)
    onClose()
  }

  async function handleDuplicate(id: string): Promise<void> {
    await duplicateCanvas(id, toast)
    refresh()
  }

  async function handleRename(id: string, name: string): Promise<void> {
    await renameCanvas(id, name)
    refresh()
  }

  async function handleDelete(id: string): Promise<void> {
    await deleteCanvasWithUndo(id, toast)
    refresh()
  }

  async function handleNewCanvas(): Promise<void> {
    await createNewCanvas()
    refresh()
    onClose()
  }

  function handleExport(): void {
    exportActiveCanvasAsJson()
  }

  function handleImportClick(): void {
    fileInputRef.current?.click()
  }

  async function handleFileSelected(event: ChangeEvent<HTMLInputElement>): Promise<void> {
    const file = event.target.files?.[0]
    event.target.value = ""
    if (file === undefined) {
      return
    }
    const text = await file.text()
    await importCanvasFromJson(text, toast)
    refresh()
    onClose()
  }

  async function handleCopyShareLink(): Promise<void> {
    const url = copyShareLink()
    try {
      await navigator.clipboard.writeText(url)
      toast.show({ message: "Share link copied to clipboard." })
    } catch {
      toast.show({ message: url })
    }
  }

  if (!isOpen) {
    return null
  }

  return createPortal(
    // biome-ignore lint/a11y/useKeyWithClickEvents: click-outside-to-close is mouse-only by nature; the keyboard equivalent is Esc, already wired by useFocusTrap below.
    // biome-ignore lint/a11y/noStaticElementInteractions: purely a click-outside-to-close catcher behind the role="dialog" panel; it carries no semantics of its own for assistive tech to announce.
    <div className={styles.backdrop} onClick={onClose}>
      {/* biome-ignore lint/a11y/useKeyWithClickEvents: stopPropagation shield only, not an interactive action of its own. */}
      <div
        ref={panelRef}
        role="dialog"
        aria-modal="true"
        aria-label="Canvases"
        className={styles.panel}
        onClick={(event) => event.stopPropagation()}
      >
        <div className={styles.header}>
          <h2 className={styles.heading}>Canvases</h2>
          <IconButton icon="close" aria-label="Close menu" onClick={onClose} />
        </div>

        <div className={styles.searchRow}>
          <SearchField
            ref={searchInputRef}
            value={query}
            onChange={setQuery}
            placeholder="Search canvases…"
            aria-label="Search canvases"
            className={styles.search}
          />
        </div>

        <Button variant="secondary" className={styles.newCanvas} onClick={handleNewCanvas}>
          <Icon name="plus" size={16} /> New canvas
        </Button>

        {filtered.length === 0 ? (
          <p className={styles.empty}>
            {summaries.length === 0 ? "No saved canvases yet." : "No canvases match your search."}
          </p>
        ) : (
          <ul className={styles.list}>
            {filtered.map((summary) => (
              <DrawerRow
                key={summary.id}
                summary={summary}
                isActive={summary.id === activeId}
                onOpen={() => void handleOpen(summary.id)}
                onRename={(name) => void handleRename(summary.id, name)}
                onDuplicate={() => void handleDuplicate(summary.id)}
                onDelete={() => void handleDelete(summary.id)}
              />
            ))}
          </ul>
        )}

        <div className={styles.footer}>
          <input
            ref={fileInputRef}
            type="file"
            accept="application/json"
            className={styles.hiddenFileInput}
            onChange={(event) => void handleFileSelected(event)}
            aria-hidden="true"
            tabIndex={-1}
          />
          <div className={styles.footerActions}>
            <Button variant="ghost" onClick={handleImportClick}>
              <Icon name="upload" size={16} /> Import JSON
            </Button>
            <Button variant="ghost" onClick={handleExport}>
              <Icon name="download" size={16} /> Export JSON
            </Button>
            <Button variant="ghost" onClick={() => void handleCopyShareLink()}>
              <Icon name="link" size={16} /> Copy share link
            </Button>
          </div>
          <span className={styles.patchLabel}>Data: patch {effectivePatch}</span>
        </div>
      </div>
    </div>,
    document.body,
  )
}
