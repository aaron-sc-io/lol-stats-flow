/**
 * Typed-handle id scheme (plan §5, deliverable 1): champion item-set rows
 * each get their own source handle, namespaced so a champion with several
 * item sets still exposes one handle per row; combo/graph handles are
 * fixed, singular ids.
 */

const ITEM_SET_HANDLE_PREFIX = "itemset:"

export function itemSetHandleId(itemSetId: string): string {
  return `${ITEM_SET_HANDLE_PREFIX}${itemSetId}`
}

/** Returns the itemSetId encoded in a champion source handle id, or `null`
 * if the handle id doesn't match the `itemset:<id>` scheme. */
export function parseItemSetHandleId(handleId: string | null | undefined): string | null {
  if (handleId === null || handleId === undefined || !handleId.startsWith(ITEM_SET_HANDLE_PREFIX)) {
    return null
  }
  return handleId.slice(ITEM_SET_HANDLE_PREFIX.length)
}

/** Combo's single multi-connection target handle (accepts many itemSets). */
export const COMBO_SOURCES_HANDLE = "sources"

/** Combo's single source handle (feeds into one or more Graph nodes). */
export const COMBO_OUT_HANDLE = "out"

/** Graph's single multi-connection target handle (accepts many combos). */
export const GRAPH_COMBOS_HANDLE = "combos"
