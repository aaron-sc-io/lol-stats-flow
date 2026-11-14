import type { Snapshot } from "@/data/schema"
import type { FlowNode, ItemSet } from "@/graph/types"
import { isChampionNode } from "@/graph/types"

/**
 * Per-canvas patch pin (plan D14 deliverable 2 / plan §3.3.6: "canvases
 * pinned to a patch load against it if shipped, else migrate with
 * notice"). Two pure functions: `decidePatchPin` answers "what should
 * happen when this canvas is opened", `reconcileCanvasWithSnapshot`
 * answers "what does moving this canvas onto a different snapshot do to
 * its champion/item references". Neither touches the graph store, Zod,
 * or localStorage — `src/app/` wires the decision into a banner/toast,
 * `src/persistence/bootstrap.ts` wires the reconcile into "open canvas".
 */

export type PatchPinDecision =
  | { readonly kind: "current" }
  | {
      readonly kind: "pinned-available"
      readonly pinnedPatch: string
      readonly currentPatch: string
    }
  | { readonly kind: "migrate"; readonly fromPatch: string; readonly toPatch: string }

/**
 * - `canvasPatch === currentPatch` → nothing to do, render normally.
 * - Otherwise, if `canvasPatch` is still a shipped snapshot → render
 *   *against that pinned snapshot* and surface a quiet banner offering to
 *   recalculate on the current patch (the user opts in; nothing changes
 *   until they do).
 * - Otherwise (the pinned snapshot was pruned) → the canvas must move to
 *   the current patch now, silently, with a toast notice — there is no
 *   snapshot left to render it against.
 */
export function decidePatchPin(
  canvasPatch: string,
  currentPatch: string,
  availablePatches: readonly string[],
): PatchPinDecision {
  if (canvasPatch === currentPatch) {
    return { kind: "current" }
  }
  if (availablePatches.includes(canvasPatch)) {
    return { kind: "pinned-available", pinnedPatch: canvasPatch, currentPatch }
  }
  return { kind: "migrate", fromPatch: canvasPatch, toPatch: currentPatch }
}

function isItemAvailable(itemId: number, snapshot: Snapshot): boolean {
  return snapshot.items.some((item) => item.id === itemId)
}

function isChampionAvailable(championId: string, snapshot: Snapshot): boolean {
  return snapshot.champions.some((champion) => champion.id === championId)
}

function nameForItem(itemId: number, lookupSnapshot: Snapshot | null): string {
  const found = lookupSnapshot?.items.find((item) => item.id === itemId)
  // Deliberately no "#" prefix before the numeric id — a hash immediately
  // followed by 3-8 hex-valid digits trips the token linter's hex-color
  // detector (scripts/lint-tokens.ts), which has no way to tell a CSS
  // color apart from an item id that happens to look like one.
  return found?.name ?? `item ${itemId}`
}

function nameForChampion(championId: string, lookupSnapshot: Snapshot | null): string {
  const found = lookupSnapshot?.champions.find((champion) => champion.id === championId)
  return found?.name ?? championId
}

function reconcileItemSet(
  itemSet: ItemSet,
  newSnapshot: Snapshot,
  lookupSnapshot: Snapshot | null,
  removed: string[],
): ItemSet {
  const items = itemSet.items.map((itemId) => {
    if (itemId === null || isItemAvailable(itemId, newSnapshot)) {
      return itemId
    }
    removed.push(nameForItem(itemId, lookupSnapshot))
    return null
  }) as unknown as ItemSet["items"]
  return { ...itemSet, items }
}

/**
 * Walks every champion node's `championId` and item-slot references
 * against `newSnapshot`, emptying anything that no longer exists there
 * (plan: "Items/champions removed in the new patch → slots emptied +
 * toast listing them"). `lookupSnapshot` — the snapshot the canvas is
 * *leaving* (still available when the pin is merely stale, `null` when
 * it's already been pruned) — is used only to produce human-readable
 * names for the toast; the reconcile decision itself is always made
 * against `newSnapshot`. A champion no longer present at all (not
 * expected in practice — plan D16's roster never shrinks — but handled
 * rather than crashing) is reported the same way; its node is left
 * otherwise intact; emptying item slots never removes the itemSet itself,
 * so combo steps sourced from it stay connected (plan §5: steps are
 * orphaned only when their *edge* is removed, not when their items are).
 */
export function reconcileCanvasWithSnapshot(
  nodes: readonly FlowNode[],
  newSnapshot: Snapshot,
  lookupSnapshot: Snapshot | null,
): { readonly nodes: FlowNode[]; readonly removedLabels: readonly string[] } {
  const removed: string[] = []

  const nextNodes = nodes.map((node): FlowNode => {
    if (!isChampionNode(node)) {
      return node
    }
    if (!isChampionAvailable(node.data.championId, newSnapshot)) {
      removed.push(nameForChampion(node.data.championId, lookupSnapshot))
    }
    return {
      ...node,
      data: {
        ...node.data,
        itemSets: node.data.itemSets.map((itemSet) =>
          reconcileItemSet(itemSet, newSnapshot, lookupSnapshot, removed),
        ),
      },
    }
  })

  return { nodes: nextNodes, removedLabels: removed }
}
