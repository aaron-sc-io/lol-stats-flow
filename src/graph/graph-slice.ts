import type { TargetSpec } from "@/engine"
import { generateId, isGraphFlowNode, mapNode } from "./store-helpers"
import type { GraphSet, GraphSlice } from "./store-types"

function defaultTarget(name: string): TargetSpec {
  return { id: generateId("target"), name, maxHp: 2000, bonusHp: 0, armor: 80, magicResist: 50 }
}

function normalizeActiveTargetIds(
  targetIds: readonly string[],
  candidateIds: readonly string[],
): readonly string[] {
  const allowed = new Set(targetIds)
  const deduped = candidateIds.filter((targetId, index, all) => {
    if (!allowed.has(targetId)) {
      return false
    }
    return all.indexOf(targetId) === index
  })
  return deduped.length === 0 ? (targetIds[0] === undefined ? [] : [targetIds[0]]) : deduped
}

/** Graph node data mutations (plan §5/§6/deliverable 5): target list CRUD,
 * active targets, chart type, and x-axis mode. `activeTargetIds` is
 * normalized on every target-list mutation to avoid dangling ids and always
 * keep at least one selected whenever targets exist. */
export function createGraphSlice(set: GraphSet): GraphSlice {
  return {
    addTarget: (nodeId) => {
      set((state) => ({
        nodes: mapNode(state.nodes, nodeId, isGraphFlowNode, (node) => {
          const targets = [
            ...node.data.targets,
            defaultTarget(`Target ${node.data.targets.length + 1}`),
          ]
          return {
            ...node,
            data: {
              ...node.data,
              targets,
              activeTargetIds: normalizeActiveTargetIds(
                targets.map((target) => target.id),
                node.data.activeTargetIds,
              ),
            },
          }
        }),
      }))
    },

    removeTarget: (nodeId, targetId) => {
      set((state) => ({
        nodes: mapNode(state.nodes, nodeId, isGraphFlowNode, (node) => {
          const targets = node.data.targets.filter((target) => target.id !== targetId)
          return {
            ...node,
            data: {
              ...node.data,
              targets,
              activeTargetIds: normalizeActiveTargetIds(
                targets.map((target) => target.id),
                node.data.activeTargetIds,
              ),
            },
          }
        }),
      }))
    },

    renameTarget: (nodeId, targetId, name) => {
      set((state) => ({
        nodes: mapNode(state.nodes, nodeId, isGraphFlowNode, (node) => ({
          ...node,
          data: {
            ...node.data,
            targets: node.data.targets.map((target) =>
              target.id === targetId ? { ...target, name } : target,
            ),
          },
        })),
      }))
    },

    updateTargetStat: (nodeId, targetId, field, value) => {
      set((state) => ({
        nodes: mapNode(state.nodes, nodeId, isGraphFlowNode, (node) => ({
          ...node,
          data: {
            ...node.data,
            targets: node.data.targets.map((target) =>
              target.id === targetId ? { ...target, [field]: value } : target,
            ),
          },
        })),
      }))
    },

    applyTargetPreset: (nodeId, targetId, preset) => {
      set((state) => ({
        nodes: mapNode(state.nodes, nodeId, isGraphFlowNode, (node) => ({
          ...node,
          data: {
            ...node.data,
            targets: node.data.targets.map((target) =>
              target.id === targetId
                ? {
                    ...target,
                    maxHp: preset.maxHp,
                    armor: preset.armor,
                    magicResist: preset.magicResist,
                    bonusArmor: preset.bonusArmor ?? 0,
                    bonusMagicResist: preset.bonusMagicResist ?? 0,
                    bonusHp: 0,
                  }
                : target,
            ),
          },
        })),
      }))
    },

    toggleActiveTarget: (nodeId, targetId) => {
      set((state) => ({
        nodes: mapNode(state.nodes, nodeId, isGraphFlowNode, (node) => {
          const targetIds = node.data.targets.map((target) => target.id)
          const selected = new Set(normalizeActiveTargetIds(targetIds, node.data.activeTargetIds))
          if (selected.has(targetId)) {
            if (selected.size > 1) {
              selected.delete(targetId)
            }
          } else if (targetIds.includes(targetId)) {
            selected.add(targetId)
          }
          return {
            ...node,
            data: {
              ...node.data,
              activeTargetIds: normalizeActiveTargetIds(targetIds, [...selected]),
            },
          }
        }),
      }))
    },

    setAllTargetsActive: (nodeId) => {
      set((state) => ({
        nodes: mapNode(state.nodes, nodeId, isGraphFlowNode, (node) => ({
          ...node,
          data: {
            ...node.data,
            activeTargetIds: node.data.targets.map((target) => target.id),
          },
        })),
      }))
    },

    setChartType: (nodeId, chartType) => {
      set((state) => ({
        nodes: mapNode(state.nodes, nodeId, isGraphFlowNode, (node) => ({
          ...node,
          data: { ...node.data, chartType },
        })),
      }))
    },

    setXMode: (nodeId, xMode) => {
      set((state) => ({
        nodes: mapNode(state.nodes, nodeId, isGraphFlowNode, (node) => ({
          ...node,
          data: { ...node.data, xMode },
        })),
      }))
    },

    setEffectiveSettings: (nodeId, settings) => {
      set((state) => ({
        nodes: mapNode(state.nodes, nodeId, isGraphFlowNode, (node) => ({
          ...node,
          data: { ...node.data, effective: { ...node.data.effective, ...settings } },
        })),
      }))
    },

    updateSeriesOverride: (nodeId, seriesId, override) => {
      set((state) => ({
        nodes: mapNode(state.nodes, nodeId, isGraphFlowNode, (node) => {
          const existing = node.data.seriesOverrides ?? {}
          const merged = { ...(existing[seriesId] ?? {}), ...override }
          const cleaned = Object.fromEntries(
            Object.entries(merged).filter(([, v]) => v !== undefined),
          )
          const nextOverrides: Record<string, typeof cleaned> = { ...existing }
          if (Object.keys(cleaned).length === 0) {
            delete nextOverrides[seriesId]
          } else {
            nextOverrides[seriesId] = cleaned
          }
          const hasAny = Object.keys(nextOverrides).length > 0
          const { seriesOverrides: _prev, ...restData } = node.data
          return {
            ...node,
            data: hasAny ? { ...restData, seriesOverrides: nextOverrides } : restData,
          }
        }),
      }))
    },
  }
}
