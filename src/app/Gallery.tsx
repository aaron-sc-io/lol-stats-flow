import { ButtonsSection } from "./gallery/ButtonsSection"
import { ChipsSection } from "./gallery/ChipsSection"
import { FlowSection } from "./gallery/FlowSection"
import { FormControlsSection } from "./gallery/FormControlsSection"
import styles from "./gallery/GalleryLayout.module.css"
import { HoverPickerSection } from "./gallery/HoverPickerSection"
import { ToastSection } from "./gallery/ToastSection"

/**
 * Component gallery for visual QA — every design-system primitive in its
 * default/hover/focus/disabled states, plus a HoverPicker with realistic
 * fixture data and a themed mini React Flow canvas. Lazy-loaded behind
 * `?view=gallery` (see `App.tsx`) so it never ships in the main bundle
 * chunk; not part of the product surface.
 */
export default function Gallery() {
  return (
    <div className={styles.page}>
      <h1 className={styles.pageTitle}>lol-stats-flow — Component gallery</h1>
      <ButtonsSection />
      <ChipsSection />
      <FormControlsSection />
      <ToastSection />
      <HoverPickerSection />
      <FlowSection />
    </div>
  )
}
