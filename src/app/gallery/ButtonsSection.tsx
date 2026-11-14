import { Button, type ButtonVariant } from "@/components/Button"
import { IconButton, type IconButtonSize } from "@/components/IconButton"
import { AutoFocusSwatch } from "./AutoFocusSwatch"
import styles from "./GalleryLayout.module.css"
import { GallerySwatch } from "./GallerySwatch"

const BUTTON_VARIANTS: readonly ButtonVariant[] = ["primary", "secondary", "ghost", "danger"]
const ICON_BUTTON_SIZES: readonly IconButtonSize[] = [24, 28, 32]

function ButtonVariantRow({ variant }: { readonly variant: ButtonVariant }) {
  const label = variant.charAt(0).toUpperCase() + variant.slice(1)
  return (
    <div className={styles.row}>
      <GallerySwatch label="Default">
        <Button variant={variant}>{label}</Button>
      </GallerySwatch>
      <GallerySwatch label="Hover">
        <Button variant={variant} demoState="hover">
          {label}
        </Button>
      </GallerySwatch>
      <GallerySwatch label="Focus">
        <AutoFocusSwatch>
          <Button variant={variant}>{label}</Button>
        </AutoFocusSwatch>
      </GallerySwatch>
      <GallerySwatch label="Disabled">
        <Button variant={variant} disabled>
          {label}
        </Button>
      </GallerySwatch>
    </div>
  )
}

export function ButtonsSection() {
  return (
    <section className={styles.section}>
      <h2 className={styles.sectionTitle}>Button</h2>
      {BUTTON_VARIANTS.map((variant) => (
        <ButtonVariantRow key={variant} variant={variant} />
      ))}

      <h2 className={styles.sectionTitle}>IconButton</h2>
      <div className={styles.row}>
        {ICON_BUTTON_SIZES.map((size) => (
          <GallerySwatch key={size} label={`${size}px`}>
            <IconButton icon="plus" aria-label="Add" size={size} />
          </GallerySwatch>
        ))}
      </div>
      <div className={styles.row}>
        <GallerySwatch label="Default">
          <IconButton icon="trash" aria-label="Delete" />
        </GallerySwatch>
        <GallerySwatch label="Hover">
          <IconButton icon="trash" aria-label="Delete" demoState="hover" />
        </GallerySwatch>
        <GallerySwatch label="Focus">
          <AutoFocusSwatch>
            <IconButton icon="trash" aria-label="Delete" />
          </AutoFocusSwatch>
        </GallerySwatch>
        <GallerySwatch label="Disabled">
          <IconButton icon="trash" aria-label="Delete" disabled />
        </GallerySwatch>
        <GallerySwatch label="Subtle variant">
          <IconButton icon="grip" aria-label="Reorder" variant="subtle" />
        </GallerySwatch>
      </div>
    </section>
  )
}
