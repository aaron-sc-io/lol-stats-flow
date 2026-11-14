import { forwardRef, type KeyboardEvent as ReactKeyboardEvent, useEffect, useRef } from "react"
import { IconButton } from "@/components/IconButton"
import { Icon } from "@/components/icons"
import { cx } from "@/lib/cx"
import { mergeRefs } from "@/lib/merge-refs"
import styles from "./SearchField.module.css"

export type SearchFieldProps = {
  readonly value: string
  readonly onChange: (value: string) => void
  readonly placeholder?: string | undefined
  readonly "aria-label": string
  /** When true, pressing `/` anywhere outside of another text field focuses
   * this field — the global-search affordance Linear/Vercel dashboards use. */
  readonly enableSlashHotkey?: boolean | undefined
  readonly onKeyDown?: ((event: ReactKeyboardEvent<HTMLInputElement>) => void) | undefined
  readonly disabled?: boolean | undefined
  readonly className?: string | undefined
}

function isTypingTarget(element: Element | null): boolean {
  if (element === null) {
    return false
  }
  const tag = element.tagName
  return tag === "INPUT" || tag === "TEXTAREA" || (element as HTMLElement).isContentEditable
}

export const SearchField = forwardRef<HTMLInputElement, SearchFieldProps>(function SearchField(
  {
    value,
    onChange,
    placeholder,
    "aria-label": ariaLabel,
    enableSlashHotkey = false,
    onKeyDown,
    disabled = false,
    className,
  },
  ref,
) {
  const inputRef = useRef<HTMLInputElement>(null)

  useEffect(() => {
    if (!enableSlashHotkey) {
      return
    }
    function handleKeyDown(event: KeyboardEvent) {
      if (event.key === "/" && !isTypingTarget(document.activeElement)) {
        event.preventDefault()
        inputRef.current?.focus()
      }
    }
    document.addEventListener("keydown", handleKeyDown)
    return () => document.removeEventListener("keydown", handleKeyDown)
  }, [enableSlashHotkey])

  return (
    <div className={cx(styles.root, className)} data-disabled={disabled ? "true" : undefined}>
      <Icon name="search" size={16} className={styles.leadingIcon} />
      <input
        ref={mergeRefs(inputRef, ref)}
        type="text"
        value={value}
        onChange={(event) => onChange(event.target.value)}
        onKeyDown={onKeyDown}
        placeholder={placeholder}
        aria-label={ariaLabel}
        disabled={disabled}
        className={styles.input}
        autoComplete="off"
        spellCheck={false}
      />
      {value.length > 0 && !disabled ? (
        <IconButton
          icon="close"
          aria-label="Clear search"
          size={24}
          className={styles.clear}
          onClick={() => {
            onChange("")
            inputRef.current?.focus()
          }}
        />
      ) : null}
    </div>
  )
})
