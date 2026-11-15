import { type ComponentPropsWithoutRef, forwardRef } from "react"
import { Icon } from "@/components/icons"
import { cx } from "@/lib/cx"
import styles from "./EditableText.module.css"

export type EditableTextProps = Omit<ComponentPropsWithoutRef<"input">, "type"> & {
  readonly wrapperClassName?: string | undefined
}

/**
 * Shared inline-editable text field used across node headers, item-set
 * names, target names, and the top bar's canvas title. Renders a slightly
 * lightened field surface (`--surface-input`) with a trailing pencil icon
 * affordance so editable text is visually distinct from static labels.
 *
 * Uses a `<span>` wrapper so it remains valid inside phrasing containers
 * (such as `NodeFrame`'s `.title` `<span>`) and preserves ancestor `<div>`
 * relationships inside row containers.
 */
export const EditableText = forwardRef<HTMLInputElement, EditableTextProps>(function EditableText(
  { className, wrapperClassName, ...inputProps },
  ref,
) {
  return (
    <span className={cx(styles.root, wrapperClassName)}>
      <input ref={ref} type="text" className={cx(styles.input, className)} {...inputProps} />
      <Icon name="pencil" size={16} className={styles.icon} />
    </span>
  )
})
