import type { TargetSpec } from "@/engine"
import { generateId, isGraphFlowNode, mapNode } from "./store-helpers"
import type { GraphSet, GraphSlice } from "./store-types"

function defaultTarget(name: string): TargetSpec {
  return { id: generateId("target"), name, maxHp: 2000, bonusHp: 0, armor: 80, magicResist: 50 }
}

/** Graph node data mutations (plan §5/§6/deliverable 5): target list CRUD,
 * the active target, chart type, and x-axis mode. Removing the currently
 * active target reassigns `activeTargetId` to whatever target is left
 * (or `""` if none), instead of leaving it dangling. */
export function createGraphSlice(set: GraphSet): GraphSlice {
  return {
    addTarget: (nodeId) => {
      set((state) => ({
        nodes: mapNode(state.nodes, nodeId, isGraphFlowNode, (node) => ({
          ...node,
          data: {
            ...node.data,
            targets: [
              ...node.data.targets,
              defaultTarget(`Target ${node.data.targets.length + 1}`),
            ],
          },
        })),
      }))
    },

    removeTarget: (nodeId, targetId) => {
      set((state) => ({
        nodes: mapNode(state.nodes, nodeId, isGraphFlowNode, (node) => {
          const targets = node.data.targets.filter((target) => target.id !== targetId)
          const activeTargetId =
            node.data.activeTargetId === targetId
              ? (targets[0]?.id ?? "")
              : node.data.activeTargetId
          return { ...node, data: { ...node.data, targets, activeTargetId } }
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
                    bonusHp: 0,
                  }
                : target,
            ),
          },
        })),
      }))
    },

    setActiveTarget: (nodeId, targetId) => {
      set((state) => ({
        nodes: mapNode(state.nodes, nodeId, isGraphFlowNode, (node) => ({
          ...node,
          data: { ...node.data, activeTargetId: targetId },
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
  }
}
