import { Button } from "@/components/Button"
import { useToast } from "@/components/Toast"
import styles from "./GalleryLayout.module.css"
import { GallerySwatch } from "./GallerySwatch"

export function ToastSection() {
  const { show } = useToast()

  return (
    <section className={styles.section}>
      <h2 className={styles.sectionTitle}>Toast</h2>
      <div className={styles.row}>
        <GallerySwatch label="With undo action">
          <Button
            variant="secondary"
            onClick={() =>
              show({
                message: "Item set removed",
                actionLabel: "Undo",
                onAction: () => show({ message: "Item set restored" }),
              })
            }
          >
            Remove item set
          </Button>
        </GallerySwatch>
        <GallerySwatch label="Message only">
          <Button variant="secondary" onClick={() => show({ message: "Canvas saved" })}>
            Save canvas
          </Button>
        </GallerySwatch>
      </div>
    </section>
  )
}
