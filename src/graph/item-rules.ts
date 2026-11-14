import type { ItemData } from "@/data/schema"
import { ITEM_SET_SIZE, type ItemSlotValue } from "./types"

/** Groups that exist on nearly every item (observed: 826/863 items in the
 * 16.22.1 snapshot carry `Items/ItemGroups/Default`) and therefore impose no
 * real build restriction — excluded from the uniqueness check below so
 * "share a group" only fires for groups that are actually exclusive
 * (Boots, mythic lines, Last Whisper, etc). */
const NON_RESTRICTIVE_GROUPS: ReadonlySet<string> = new Set(["Items/ItemGroups/Default"])

function restrictiveGroups(item: ItemData): readonly string[] {
  return item.uniqueGroups.filter((group) => !NON_RESTRICTIVE_GROUPS.has(group))
}

export type ItemSetValidationReason = "full" | "unique-conflict" | "max-stack"

export type ItemSetValidationResult =
  | { readonly canAdd: true }
  | {
      readonly canAdd: false
      readonly reason: ItemSetValidationReason
      readonly conflictsWith?: string
    }

/** Validates adding `candidate` to an item set's current (non-null) items,
 * enforcing plan §1's "max 6 items, standard uniqueness/group rules" using
 * the snapshot's own `uniqueGroups`/`maxStack` fields — no hardcoded item
 * list. `currentItems` is the slot array with already-resolved `ItemData`
 * (nulls filtered by the caller). */
export function canAddItemToSet(
  currentItems: readonly ItemData[],
  candidate: ItemData,
): ItemSetValidationResult {
  if (currentItems.length >= ITEM_SET_SIZE) {
    return { canAdd: false, reason: "full" }
  }

  const sameItemCount = currentItems.filter((item) => item.id === candidate.id).length
  if (sameItemCount >= Math.max(1, candidate.maxStack)) {
    return { canAdd: false, reason: "max-stack" }
  }

  const candidateGroups = restrictiveGroups(candidate)
  if (candidateGroups.length > 0) {
    const conflict = currentItems.find((item) =>
      restrictiveGroups(item).some((group) => candidateGroups.includes(group)),
    )
    if (conflict !== undefined) {
      return { canAdd: false, reason: "unique-conflict", conflictsWith: conflict.name }
    }
  }

  return { canAdd: true }
}

/** Resolves an item set's slot values (ids/nulls) into the `ItemData[]`
 * `canAddItemToSet` and `buildKit` (via `kit-cache.ts`) both need. */
export function resolveItemSlots(
  slots: readonly ItemSlotValue[],
  items: readonly ItemData[],
): ItemData[] {
  const byId = new Map(items.map((item) => [item.id, item]))
  const resolved: ItemData[] = []
  for (const slot of slots) {
    if (slot === null) {
      continue
    }
    const item = byId.get(slot)
    if (item !== undefined) {
      resolved.push(item)
    }
  }
  return resolved
}
