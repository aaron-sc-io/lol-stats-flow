import { useEffect, useRef, useState } from "react"
import { Button } from "@/components/Button"
import { IconButton } from "@/components/IconButton"
import { cx } from "@/lib/cx"
import type { CanvasSummary } from "@/persistence"
import styles from "./Drawer.module.css"

const RELATIVE_TIME_FORMATTER = new Intl.RelativeTimeFormat(undefined, { numeric: "auto" })
const RELATIVE_TIME_UNITS: ReadonlyArray<readonly [Intl.RelativeTimeFormatUnit, number]> = [
  ["year", 31536000],
  ["month", 2592000],
  ["week", 604800],
  ["day", 86400],
  ["hour", 3600],
  ["minute", 60],
]

/** No date-formatting dependency needed — `Intl.RelativeTimeFormat` is a
 * standard built-in and this app only ever needs "how long ago", not a
 * calendar. */
function formatRelativeTime(iso: string): string {
  const diffSeconds = (new Date(iso).getTime() - Date.now()) / 1000
  for (const [unit, secondsInUnit] of RELATIVE_TIME_UNITS) {
    if (Math.abs(diffSeconds) >= secondsInUnit) {
      return RELATIVE_TIME_FORMATTER.format(Math.round(diffSeconds / secondsInUnit), unit)
    }
  }
  return RELATIVE_TIME_FORMATTER.format(Math.round(diffSeconds / 60), "minute")
}

export type DrawerRowProps = {
  readonly summary: CanvasSummary
  readonly isActive: boolean
  readonly onOpen: () => void
  readonly onRename: (name: string) => void
  readonly onDuplicate: () => void
  readonly onDelete: () => void
}

/** One canvas row (plan D14 deliverable 3): open by clicking the name,
 * inline rename, duplicate, delete-with-undo (the toast lives in the
 * caller, which owns `useToast()`). */
export function DrawerRow({
  summary,
  isActive,
  onOpen,
  onRename,
  onDuplicate,
  onDelete,
}: DrawerRowProps) {
  const [isRenaming, setIsRenaming] = useState(false)
  const [draftName, setDraftName] = useState(summary.name)
  const inputRef = useRef<HTMLInputElement>(null)

  useEffect(() => {
    if (isRenaming) {
      inputRef.current?.focus()
      inputRef.current?.select()
    }
  }, [isRenaming])

  function commitRename(): void {
    const trimmed = draftName.trim()
    if (trimmed.length > 0 && trimmed !== summary.name) {
      onRename(trimmed)
    }
    setIsRenaming(false)
  }

  function startRenaming(): void {
    setDraftName(summary.name)
    setIsRenaming(true)
  }

  return (
    <li className={cx(styles.row, isActive && styles.rowActive)}>
      {isRenaming ? (
        <input
          ref={inputRef}
          className={styles.renameInput}
          value={draftName}
          onChange={(event) => setDraftName(event.target.value)}
          onBlur={commitRename}
          onKeyDown={(event) => {
            if (event.key === "Enter") {
              event.preventDefault()
              commitRename()
            } else if (event.key === "Escape") {
              event.preventDefault()
              setIsRenaming(false)
            }
          }}
          aria-label={`Rename ${summary.name}`}
        />
      ) : (
        <button type="button" className={styles.rowName} onClick={onOpen}>
          <span className={styles.name}>{summary.name}</span>
          <span className={styles.meta}>
            {formatRelativeTime(summary.updatedAt)} · Patch {summary.patch}
          </span>
        </button>
      )}
      <div className={styles.rowActions}>
        {isRenaming ? null : (
          <Button variant="ghost" className={styles.renameButton} onClick={startRenaming}>
            Rename
          </Button>
        )}
        <IconButton icon="copy" aria-label={`Duplicate ${summary.name}`} onClick={onDuplicate} />
        <IconButton icon="trash" aria-label={`Delete ${summary.name}`} onClick={onDelete} />
      </div>
    </li>
  )
}
