import type { HoverPickerFilter } from "@/components/HoverPicker"
import type { IconName } from "@/components/icons"

export type GalleryPickerEntry = {
  readonly id: string
  readonly name: string
  readonly role: "top" | "jungle" | "mid" | "bottom" | "support"
  readonly modeled: boolean
}

const ROLES = ["top", "jungle", "mid", "bottom", "support"] as const

function roleAt(index: number): GalleryPickerEntry["role"] {
  const role = ROLES[index % ROLES.length]
  if (role === undefined) {
    throw new Error("unreachable: index % ROLES.length is always in range")
  }
  return role
}

const ENTRY_COUNT = 60

/** 60 fake roster entries for the HoverPicker gallery demo — roughly 1 in
 * 7 unmodeled, cycling through all 5 roles, so every filter and the
 * disabled-badge state both have real matches to show. */
export const GALLERY_PICKER_ENTRIES: readonly GalleryPickerEntry[] = Array.from(
  { length: ENTRY_COUNT },
  (_, index) => ({
    id: `entry-${index + 1}`,
    name: `Champion ${index + 1}`,
    role: roleAt(index),
    modeled: index % 7 !== 0,
  }),
)

const ROLE_FILTER_ICON: Record<"top" | "jungle" | "mid" | "bottom", IconName> = {
  top: "role-top",
  jungle: "role-jungle",
  mid: "role-mid",
  bottom: "role-bottom",
}

export const GALLERY_PICKER_FILTERS: ReadonlyArray<HoverPickerFilter<GalleryPickerEntry>> = (
  ["top", "jungle", "mid", "bottom"] as const
).map((role) => ({
  id: role,
  icon: ROLE_FILTER_ICON[role],
  label: role.charAt(0).toUpperCase() + role.slice(1),
  predicate: (entry: GalleryPickerEntry) => entry.role === role,
}))
