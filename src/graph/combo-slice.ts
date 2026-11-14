import { generateId, isComboFlowNode, mapNode } from "./store-helpers"
import type { ComboSlice, GraphSet } from "./store-types"

function arrayMove<T>(list: readonly T[], fromIndex: number, toIndex: number): T[] {
  const next = [...list]
  const [moved] = next.splice(fromIndex, 1)
  if (moved === undefined) {
    return next
  }
  next.splice(toIndex, 0, moved)
  return next
}

/** Combo node data mutations (plan §5/§6/deliverable 4): name, the
 * timeline's full step CRUD (add/remove/reorder/delay), and which
 * ability-palette sections are collapsed. Steps are never validated
 * against current connections here — a step whose source has been
 * disconnected is simply left in place, orphaned (derived, not stored). */
export function createComboSlice(set: GraphSet): ComboSlice {
  return {
    renameCombo: (nodeId, name) => {
      set((state) => ({
        nodes: mapNode(state.nodes, nodeId, isComboFlowNode, (node) => ({
          ...node,
          data: { ...node.data, name },
        })),
      }))
    },

    addComboStep: (nodeId, sourceId, actionId) => {
      set((state) => ({
        nodes: mapNode(state.nodes, nodeId, isComboFlowNode, (node) => ({
          ...node,
          data: {
            ...node.data,
            steps: [...node.data.steps, { id: generateId("step"), sourceId, actionId }],
          },
        })),
      }))
    },

    removeComboStep: (nodeId, stepId) => {
      set((state) => ({
        nodes: mapNode(state.nodes, nodeId, isComboFlowNode, (node) => ({
          ...node,
          data: { ...node.data, steps: node.data.steps.filter((step) => step.id !== stepId) },
        })),
      }))
    },

    restoreComboStep: (nodeId, step, atIndex) => {
      set((state) => ({
        nodes: mapNode(state.nodes, nodeId, isComboFlowNode, (node) => {
          const steps = [...node.data.steps]
          const clampedIndex = Math.max(0, Math.min(atIndex, steps.length))
          steps.splice(clampedIndex, 0, step)
          return { ...node, data: { ...node.data, steps } }
        }),
      }))
    },

    reorderComboSteps: (nodeId, fromIndex, toIndex) => {
      set((state) => ({
        nodes: mapNode(state.nodes, nodeId, isComboFlowNode, (node) => ({
          ...node,
          data: { ...node.data, steps: arrayMove(node.data.steps, fromIndex, toIndex) },
        })),
      }))
    },

    setComboStepDelay: (nodeId, stepId, delayMs) => {
      set((state) => ({
        nodes: mapNode(state.nodes, nodeId, isComboFlowNode, (node) => ({
          ...node,
          data: {
            ...node.data,
            steps: node.data.steps.map((step) =>
              step.id === stepId ? { ...step, delayMs } : step,
            ),
          },
        })),
      }))
    },

    toggleComboSectionCollapsed: (nodeId, itemSetId) => {
      set((state) => ({
        nodes: mapNode(state.nodes, nodeId, isComboFlowNode, (node) => {
          const isCollapsed = node.data.collapsedSections.includes(itemSetId)
          const collapsedSections = isCollapsed
            ? node.data.collapsedSections.filter((id) => id !== itemSetId)
            : [...node.data.collapsedSections, itemSetId]
          return { ...node, data: { ...node.data, collapsedSections } }
        }),
      }))
    },
  }
}
