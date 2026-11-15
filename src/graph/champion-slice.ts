import { clampLevel } from "@/engine/stats/stats-at"
import { itemSetHandleId } from "./handle-ids"
import { generateId, isChampionFlowNode, mapNode } from "./store-helpers"
import type { ChampionSlice, GraphSet } from "./store-types"
import { ITEM_SET_SIZE, type ItemSet, type ItemSlotValue } from "./types"

function emptyItemSet(name: string): ItemSet {
  return {
    id: generateId("itemset"),
    name,
    items: [null, null, null, null, null, null],
    rankOverrides: {},
  }
}

function replaceItemSet(
  itemSets: readonly ItemSet[],
  itemSetId: string,
  update: (itemSet: ItemSet) => ItemSet,
): ItemSet[] {
  return itemSets.map((itemSet) => (itemSet.id === itemSetId ? update(itemSet) : itemSet))
}

function replaceSlot(
  items: ItemSet["items"],
  index: number,
  value: ItemSlotValue,
): ItemSet["items"] {
  const next: [
    ItemSlotValue,
    ItemSlotValue,
    ItemSlotValue,
    ItemSlotValue,
    ItemSlotValue,
    ItemSlotValue,
  ] = [...items]
  if (index >= 0 && index < ITEM_SET_SIZE) {
    next[index] = value
  }
  return next
}

/** Champion node data mutations (plan §5/deliverable 1): championId/level,
 * and full item-set row CRUD. `removeItemSet` also strips the row's own
 * edge so the orphaning derivation (`selectors.ts`) picks it up
 * immediately — no separate "orphaned" flag is ever stored. */
export function createChampionSlice(set: GraphSet): ChampionSlice {
  return {
    setChampionId: (nodeId, championId) => {
      set((state) => ({
        nodes: mapNode(state.nodes, nodeId, isChampionFlowNode, (node) => ({
          ...node,
          data: { ...node.data, championId },
        })),
      }))
    },

    setChampionLevel: (nodeId, level) => {
      const clamped = clampLevel(level)
      set((state) => ({
        nodes: mapNode(state.nodes, nodeId, isChampionFlowNode, (node) => ({
          ...node,
          data: { ...node.data, level: clamped },
        })),
      }))
    },

    addItemSet: (nodeId) => {
      set((state) => ({
        nodes: mapNode(state.nodes, nodeId, isChampionFlowNode, (node) => ({
          ...node,
          data: {
            ...node.data,
            itemSets: [
              ...node.data.itemSets,
              emptyItemSet(`Build ${node.data.itemSets.length + 1}`),
            ],
          },
        })),
      }))
    },

    removeItemSet: (nodeId, itemSetId) => {
      const handle = itemSetHandleId(itemSetId)
      set((state) => ({
        nodes: mapNode(state.nodes, nodeId, isChampionFlowNode, (node) => ({
          ...node,
          data: {
            ...node.data,
            itemSets: node.data.itemSets.filter((itemSet) => itemSet.id !== itemSetId),
          },
        })),
        edges: state.edges.filter(
          (edge) => !(edge.source === nodeId && edge.sourceHandle === handle),
        ),
      }))
    },

    duplicateItemSet: (nodeId, itemSetId) => {
      set((state) => ({
        nodes: mapNode(state.nodes, nodeId, isChampionFlowNode, (node) => {
          const index = node.data.itemSets.findIndex((itemSet) => itemSet.id === itemSetId)
          const original = node.data.itemSets[index]
          if (original === undefined) {
            return node
          }
          const copy: ItemSet = {
            ...original,
            id: generateId("itemset"),
            name: `${original.name} (copy)`,
          }
          const itemSets = [...node.data.itemSets]
          itemSets.splice(index + 1, 0, copy)
          return { ...node, data: { ...node.data, itemSets } }
        }),
      }))
    },

    reorderItemSets: (nodeId, fromIndex, toIndex) => {
      set((state) => ({
        nodes: mapNode(state.nodes, nodeId, isChampionFlowNode, (node) => {
          const itemSets = [...node.data.itemSets]
          const [moved] = itemSets.splice(fromIndex, 1)
          if (moved === undefined) {
            return node
          }
          itemSets.splice(toIndex, 0, moved)
          return { ...node, data: { ...node.data, itemSets } }
        }),
      }))
    },

    renameItemSet: (nodeId, itemSetId, name) => {
      set((state) => ({
        nodes: mapNode(state.nodes, nodeId, isChampionFlowNode, (node) => ({
          ...node,
          data: {
            ...node.data,
            itemSets: replaceItemSet(node.data.itemSets, itemSetId, (itemSet) => ({
              ...itemSet,
              name,
            })),
          },
        })),
      }))
    },

    setItemSlot: (nodeId, itemSetId, slotIndex, itemId) => {
      set((state) => ({
        nodes: mapNode(state.nodes, nodeId, isChampionFlowNode, (node) => ({
          ...node,
          data: {
            ...node.data,
            itemSets: replaceItemSet(node.data.itemSets, itemSetId, (itemSet) => ({
              ...itemSet,
              items: replaceSlot(itemSet.items, slotIndex, itemId),
            })),
          },
        })),
      }))
    },

    setItemSetRankOverride: (nodeId, itemSetId, slot, rank) => {
      set((state) => ({
        nodes: mapNode(state.nodes, nodeId, isChampionFlowNode, (node) => ({
          ...node,
          data: {
            ...node.data,
            itemSets: replaceItemSet(node.data.itemSets, itemSetId, (itemSet) => {
              const rankOverrides = { ...itemSet.rankOverrides }
              if (rank === undefined) {
                delete rankOverrides[slot]
              } else {
                rankOverrides[slot] = rank
              }
              return { ...itemSet, rankOverrides }
            }),
          },
        })),
      }))
    },
  }
}
