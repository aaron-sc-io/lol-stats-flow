import { useState } from "react"
import { Collapsible } from "@/components/Collapsible"
import { Listbox } from "@/components/Listbox"
import { NumberField } from "@/components/NumberField"
import { SearchField } from "@/components/SearchField"
import { SegmentedControl } from "@/components/SegmentedControl"
import { Slider } from "@/components/Slider"
import { AutoFocusSwatch } from "./AutoFocusSwatch"
import styles from "./GalleryLayout.module.css"
import { GallerySwatch } from "./GallerySwatch"

const CHART_OPTIONS = [
  { value: "bars", label: "Bars" },
  { value: "cumulative", label: "Cumulative" },
  { value: "hp", label: "HP left" },
] as const

const ROLE_OPTIONS = [
  { id: "top", label: "Top" },
  { id: "jungle", label: "Jungle" },
  { id: "mid", label: "Mid" },
]

function SearchFieldSection() {
  const [value, setValue] = useState("")
  return (
    <div className={styles.row}>
      <GallerySwatch label="Default">
        <SearchField value="" onChange={() => {}} aria-label="Search" placeholder="Search…" />
      </GallerySwatch>
      <GallerySwatch label="With value + clear">
        <SearchField value={value} onChange={setValue} aria-label="Search" placeholder="Search…" />
      </GallerySwatch>
      <GallerySwatch label="Focus">
        <AutoFocusSwatch>
          <SearchField value="" onChange={() => {}} aria-label="Search" placeholder="Search…" />
        </AutoFocusSwatch>
      </GallerySwatch>
      <GallerySwatch label="Disabled">
        <SearchField
          value=""
          onChange={() => {}}
          aria-label="Search"
          placeholder="Search…"
          disabled
        />
      </GallerySwatch>
    </div>
  )
}

function SliderSection() {
  const [level, setLevel] = useState(11)
  return (
    <div className={styles.row}>
      <GallerySwatch label="Interactive">
        <div style={{ width: 160 }}>
          <Slider
            value={level}
            min={1}
            max={20}
            onChange={setLevel}
            aria-label="Champion level"
            unit="lvl"
          />
        </div>
      </GallerySwatch>
      <GallerySwatch label="Disabled">
        <div style={{ width: 160 }}>
          <Slider
            value={9}
            min={1}
            max={20}
            onChange={() => {}}
            aria-label="Champion level"
            disabled
          />
        </div>
      </GallerySwatch>
    </div>
  )
}

function NumberFieldSection() {
  const [armor, setArmor] = useState(40)
  return (
    <div className={styles.row}>
      <GallerySwatch label="Interactive">
        <NumberField
          value={armor}
          onChange={setArmor}
          min={0}
          max={300}
          unit="armor"
          aria-label="Armor"
        />
      </GallerySwatch>
      <GallerySwatch label="Focus">
        <AutoFocusSwatch>
          <NumberField
            value={40}
            onChange={() => {}}
            min={0}
            max={300}
            unit="armor"
            aria-label="Armor"
          />
        </AutoFocusSwatch>
      </GallerySwatch>
      <GallerySwatch label="Disabled">
        <NumberField
          value={40}
          onChange={() => {}}
          min={0}
          max={300}
          unit="armor"
          aria-label="Armor"
          disabled
        />
      </GallerySwatch>
    </div>
  )
}

function SegmentedControlSection() {
  const [chartType, setChartType] = useState<(typeof CHART_OPTIONS)[number]["value"]>("bars")
  return (
    <div className={styles.row}>
      <GallerySwatch label="Interactive">
        <SegmentedControl
          options={CHART_OPTIONS}
          value={chartType}
          onChange={setChartType}
          aria-label="Chart type"
        />
      </GallerySwatch>
    </div>
  )
}

function ListboxSection() {
  const [role, setRole] = useState<(typeof ROLE_OPTIONS)[number] | null>(null)
  return (
    <div className={styles.row}>
      <GallerySwatch label="Interactive">
        <Listbox
          items={ROLE_OPTIONS}
          value={role}
          onChange={setRole}
          getKey={(option) => option.id}
          getLabel={(option) => option.label}
          aria-label="Role"
          placeholder="Select a role"
        />
      </GallerySwatch>
      <GallerySwatch label="Disabled">
        <Listbox
          items={ROLE_OPTIONS}
          value={null}
          onChange={() => {}}
          getKey={(option) => option.id}
          getLabel={(option) => option.label}
          aria-label="Role"
          placeholder="Select a role"
          disabled
        />
      </GallerySwatch>
    </div>
  )
}

function CollapsibleSection() {
  return (
    <div className={styles.row}>
      <GallerySwatch label="Closed (default)">
        <div style={{ width: 220 }}>
          <Collapsible label="Yasuo — Infinity Edge">
            <div>Q · W · E · R · AA</div>
          </Collapsible>
        </div>
      </GallerySwatch>
      <GallerySwatch label="Open">
        <div style={{ width: 220 }}>
          <Collapsible label="Darius — Black Cleaver" defaultOpen>
            <div>Q · W · E · R · AA</div>
          </Collapsible>
        </div>
      </GallerySwatch>
    </div>
  )
}

export function FormControlsSection() {
  return (
    <>
      <section className={styles.section}>
        <h2 className={styles.sectionTitle}>SearchField</h2>
        <SearchFieldSection />
      </section>
      <section className={styles.section}>
        <h2 className={styles.sectionTitle}>Slider</h2>
        <SliderSection />
      </section>
      <section className={styles.section}>
        <h2 className={styles.sectionTitle}>NumberField</h2>
        <NumberFieldSection />
      </section>
      <section className={styles.section}>
        <h2 className={styles.sectionTitle}>SegmentedControl</h2>
        <SegmentedControlSection />
      </section>
      <section className={styles.section}>
        <h2 className={styles.sectionTitle}>Listbox</h2>
        <ListboxSection />
      </section>
      <section className={styles.section}>
        <h2 className={styles.sectionTitle}>Collapsible</h2>
        <CollapsibleSection />
      </section>
    </>
  )
}
