import { Badge } from "@/components/Badge"
import { DamageTypeChip } from "@/components/DamageTypeChip"
import styles from "./GalleryLayout.module.css"
import { GallerySwatch } from "./GallerySwatch"

export function ChipsSection() {
  return (
    <>
      <section className={styles.section}>
        <h2 className={styles.sectionTitle}>Badge</h2>
        <div className={styles.row}>
          <GallerySwatch label="Neutral">
            <Badge>Not modeled</Badge>
          </GallerySwatch>
        </div>
      </section>

      <section className={styles.section}>
        <h2 className={styles.sectionTitle}>DamageTypeChip</h2>
        <div className={styles.row}>
          <GallerySwatch label="Physical">
            <DamageTypeChip type="physical">1,284</DamageTypeChip>
          </GallerySwatch>
          <GallerySwatch label="Magic">
            <DamageTypeChip type="magic">892</DamageTypeChip>
          </GallerySwatch>
          <GallerySwatch label="True">
            <DamageTypeChip type="true">410</DamageTypeChip>
          </GallerySwatch>
        </div>
      </section>
    </>
  )
}
