import type { Snapshot } from "@/data/schema"
import type { ComboStep, Kit } from "@/engine"
import { getOrBuildKit } from "./kit-cache"
import { type ConnectedItemSetSource, isStepOrphaned, resolveStepChampionNodeId } from "./selectors"

/** One function a combo outputs: its step list replayed with one specific
 * item set chosen for every connected champion. A combo fed N item sets of
 * one champion outputs N variants; with several champions it outputs every
 * combination of their item sets (the item set × combo matrix the graph
 * plots). */
export type ComboVariant = {
  /** The chosen item set ids joined — stable across renders. Empty when
   * nothing is connected. */
  readonly variantId: string
  /** The chosen item sets' names, e.g. `"Infinity Edge"` or
   * `"Infinity Edge + Liandry's"`. Empty when nothing is connected. */
  readonly variantName: string
  readonly itemSetIds: readonly string[]
  /** Keyed by champion node id. */
  readonly kits: Readonly<Record<string, Kit>>
  /** Non-orphaned steps with `sourceId` normalized to the champion node id —
   * ready for `simulate()`. */
  readonly steps: readonly ComboStep[]
}

/** A combo's connected item sets grouped per champion node, in edge order —
 * one palette row per group, one variant axis per group. */
export function groupSourcesByChampion(
  sources: readonly ConnectedItemSetSource[],
): ConnectedItemSetSource[][] {
  const groups = new Map<string, ConnectedItemSetSource[]>()
  for (const source of sources) {
    const group = groups.get(source.championNode.id) ?? []
    if (!group.some((existing) => existing.itemSetId === source.itemSetId)) {
      group.push(source)
    }
    groups.set(source.championNode.id, group)
  }
  return [...groups.values()]
}

function cartesian<T>(lists: readonly (readonly T[])[]): T[][] {
  return lists.reduce<T[][]>(
    (combos, list) => combos.flatMap((prefix) => list.map((item) => [...prefix, item])),
    [[]],
  )
}

function toSimulationSteps(
  steps: readonly ComboStep[],
  sources: readonly ConnectedItemSetSource[],
  kits: Readonly<Record<string, Kit>>,
): ComboStep[] {
  return steps.flatMap((step) => {
    const championNodeId = resolveStepChampionNodeId(step, sources)
    if (championNodeId === undefined || isStepOrphaned(step, sources, kits)) {
      return []
    }
    return [championNodeId === step.sourceId ? step : { ...step, sourceId: championNodeId }]
  })
}

/** Every variant a combo outputs, in edge order. With no connected item set
 * this is a single empty variant (no kits, no steps) so the combo still
 * shows up — as zero damage — wherever it's plotted. */
export function buildComboVariants(
  snapshot: Snapshot,
  sources: readonly ConnectedItemSetSource[],
  steps: readonly ComboStep[],
): ComboVariant[] {
  return cartesian(groupSourcesByChampion(sources)).map((choice) => {
    const kits: Record<string, Kit> = {}
    for (const source of choice) {
      const kit = getOrBuildKit(
        snapshot,
        source.championNode.data.championId,
        source.championNode.data.level,
        source.itemSet,
      )
      if (kit !== undefined) {
        kits[source.championNode.id] = kit
      }
    }
    return {
      variantId: choice.map((source) => source.itemSetId).join("+"),
      variantName: choice.map((source) => source.itemSet.name).join(" + "),
      itemSetIds: choice.map((source) => source.itemSetId),
      kits,
      steps: toSimulationSteps(steps, sources, kits),
    }
  })
}
