import type { ReactNode } from "react"
import styles from "./GalleryLayout.module.css"

/** One labeled example within a gallery row — e.g. "DEFAULT" above a button. */
export function GallerySwatch({
  label,
  children,
}: {
  readonly label: string
  readonly children: ReactNode
}) {
  return (
    <div className={styles.swatch}>
      <span className={styles.swatchLabel}>{label}</span>
      {children}
    </div>
  )
}
