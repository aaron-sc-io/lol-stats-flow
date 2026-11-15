import { describe, expect, it } from "vitest"
import { loadSnapshotFixture } from "@/engine/test-support/load-snapshot"
import { deriveGraphNodeData } from "./graph-node-derivation"
import {
  COMBO_OUT_HANDLE,
  COMBO_SOURCES_HANDLE,
  GRAPH_COMBOS_HANDLE,
  itemSetHandleId,
} from "./handle-ids"
import type { ChampionFlowNode, ComboFlowNode, FlowEdge, FlowNode, GraphFlowNode } from "./types"

const snapshot = loadSnapshotFixture()

function champion(): ChampionFlowNode {
  return {
    id: "champ-1",
    type: "champion",
    position: { x: 0, y: 0 },
    data: {
      championId: "Yasuo",
      level: 11,
      itemSets: [
        { id: "is-1", name: "IE", items: [3031, null, null, null, null, null], rankOverrides: {} },
      ],
    },
  }
}

function combo(steps: ComboFlowNode["data"]["steps"]): ComboFlowNode {
  return {
    id: "combo-1",
    type: "combo",
    position: { x: 0, y: 0 },
    data: { name: "Combo 1", steps, collapsedSections: [] },
  }
}

function graph(): GraphFlowNode {
  return {
    id: "graph-1",
    type: "graph",
    position: { x: 0, y: 0 },
    data: {
      targets: [
        { id: "t1", name: "Squishy", maxHp: 1000, bonusHp: 0, armor: 0, magicResist: 0 },
        { id: "t2", name: "Tank", maxHp: 4000, bonusHp: 0, armor: 150, magicResist: 100 },
      ],
      activeTargetIds: ["t1"],
      chartType: "cumulative",
      xMode: "step",
    },
  }
}

function edges(): FlowEdge[] {
  return [
    {
      id: "e1",
      source: "champ-1",
      sourceHandle: itemSetHandleId("is-1"),
      target: "combo-1",
      targetHandle: COMBO_SOURCES_HANDLE,
      type: "flow",
      data: {},
    },
    {
      id: "e2",
      source: "combo-1",
      sourceHandle: COMBO_OUT_HANDLE,
      target: "graph-1",
      targetHandle: GRAPH_COMBOS_HANDLE,
      type: "flow",
      data: {},
    },
  ]
}

describe("deriveGraphNodeData", () => {
  it("produces one chart series (against the active target) per connected combo", () => {
    const nodes: FlowNode[] = [
      champion(),
      combo([{ id: "s1", sourceId: "is-1", actionId: "Q" }]),
      graph(),
    ]
    const { series } = deriveGraphNodeData("graph-1", graph().data, nodes, edges(), snapshot)

    expect(series).toHaveLength(1)
    expect(series[0]?.comboId).toBe("combo-1")
    expect(series[0]?.targetId).toBe("t1")
    // A zero-damage "Step 0" origin, then the one real step.
    expect(series[0]?.points).toHaveLength(2)
    expect(series[0]?.points[0]).toMatchObject({ xLabel: "Step 0", total: 0, cumulative: 0 })
    expect(series[0]?.points[0]?.targetHpAfter).toBe(graph().data.targets[0]?.maxHp)
    expect(series[0]?.points[1]?.physical).toBeGreaterThan(0)
  })

  it("produces one chart series per selected target for each connected combo", () => {
    const selectedBothTargets = {
      ...graph().data,
      activeTargetIds: ["t1", "t2"],
    }
    const nodes: FlowNode[] = [
      champion(),
      combo([{ id: "s1", sourceId: "is-1", actionId: "Q" }]),
      { ...graph(), data: selectedBothTargets },
    ]

    const { series } = deriveGraphNodeData("graph-1", selectedBothTargets, nodes, edges(), snapshot)

    expect(series).toHaveLength(2)
    expect(series.map((item) => item.targetId).sort()).toEqual(["t1", "t2"])
  })

  it("produces a comparison row for every combo x target pair, not just the active target", () => {
    const nodes: FlowNode[] = [
      champion(),
      combo([{ id: "s1", sourceId: "is-1", actionId: "Q" }]),
      graph(),
    ]
    const { rows } = deriveGraphNodeData("graph-1", graph().data, nodes, edges(), snapshot)

    expect(rows).toHaveLength(2)
    expect(rows.map((row) => row.targetId).sort()).toEqual(["t1", "t2"])
    // The same raw hit mitigates less against the tankier target.
    const squishyRow = rows.find((row) => row.targetId === "t1")
    const tankRow = rows.find((row) => row.targetId === "t2")
    expect(squishyRow?.total ?? 0).toBeGreaterThan(tankRow?.total ?? 0)
  })

  it("excludes an orphaned step's champion from the sim once its edge is removed", () => {
    const nodes: FlowNode[] = [
      champion(),
      combo([{ id: "s1", sourceId: "is-1", actionId: "Q" }]),
      graph(),
    ]
    const { rows } = deriveGraphNodeData(
      "graph-1",
      graph().data,
      nodes,
      [edges()[1] as FlowEdge],
      snapshot,
    )

    // No itemSet->combo edge means the step is orphaned and excluded —
    // total damage is 0, not an error.
    expect(rows.every((row) => row.total === 0)).toBe(true)
  })

  it("returns no series/rows for a graph with no connected combos", () => {
    const nodes: FlowNode[] = [graph()]
    const { series, rows } = deriveGraphNodeData("graph-1", graph().data, nodes, [], snapshot)
    expect(series).toEqual([])
    expect(rows).toEqual([])
  })

  it("plots one function per connected item set: the same steps replayed with each set's items", () => {
    const base = champion()
    const twoSets: ChampionFlowNode = {
      ...base,
      data: {
        ...base.data,
        itemSets: [
          ...base.data.itemSets,
          {
            id: "is-2",
            name: "No items",
            items: [null, null, null, null, null, null],
            rankOverrides: {},
          },
        ],
      },
    }
    const nodes: FlowNode[] = [
      twoSets,
      combo([{ id: "s1", sourceId: "champ-1", actionId: "Q" }]),
      graph(),
    ]
    const secondSetEdge: FlowEdge = {
      ...(edges()[0] as FlowEdge),
      id: "e3",
      sourceHandle: itemSetHandleId("is-2"),
    }

    const { series, rows } = deriveGraphNodeData(
      "graph-1",
      graph().data,
      nodes,
      [...edges(), secondSetEdge],
      snapshot,
    )

    expect(series.map((item) => item.variantName)).toEqual(["IE", "No items"])
    expect(new Set(series.map((item) => item.seriesId)).size).toBe(2)
    expect(series.map((item) => item.itemSetIds)).toEqual([["is-1"], ["is-2"]])
    const [withIe, withoutItems] = series.map((item) => item.points[1]?.total ?? 0)
    expect(withIe).toBeGreaterThan(withoutItems ?? 0)
    // combo × item set × every target
    expect(rows).toHaveLength(4)
  })

  it("resists graph: sweeps only the chosen axis and does not cap damage at the target's HP", () => {
    const nodes: FlowNode[] = [
      champion(),
      combo([{ id: "s1", sourceId: "is-1", actionId: "Q" }]),
      graph(),
    ]
    const armorData = { ...graph().data, graphKind: "resists" as const }
    const mrData = { ...armorData, effective: { resistAxis: "magicResist" as const } }
    const armor = deriveGraphNodeData("graph-1", armorData, nodes, edges(), snapshot).series[0]
    const mr = deriveGraphNodeData("graph-1", mrData, nodes, edges(), snapshot).series[0]

    const armorTotals = armor?.points.map((point) => point.total) ?? []
    expect(armorTotals[0]).toBeGreaterThan(armorTotals[armorTotals.length - 1] ?? 0)
    // A physical-only combo is unaffected by sweeping MR.
    const mrTotals = new Set(mr?.points.map((point) => Math.round(point.total)))
    expect(mrTotals.size).toBe(1)
    expect(armor?.targetHp).toBe(1000)

    const lowHp = {
      ...armorData,
      targets: [{ id: "t1", name: "Tiny", maxHp: 1, bonusHp: 0, armor: 0, magicResist: 0 }],
    }
    const uncapped = deriveGraphNodeData("graph-1", lowHp, nodes, edges(), snapshot).series[0]
    expect(uncapped?.points[0]?.total ?? 0).toBeGreaterThan(1)
  })

  it("kill map: compares two variants over HP x resist, and the stronger build never loses a kill", () => {
    const base = champion()
    const twoSets: ChampionFlowNode = {
      ...base,
      data: {
        ...base.data,
        itemSets: [
          ...base.data.itemSets,
          {
            id: "is-2",
            name: "No items",
            items: [null, null, null, null, null, null],
            rankOverrides: {},
          },
        ],
      },
    }
    const nodes: FlowNode[] = [
      twoSets,
      combo([{ id: "s1", sourceId: "champ-1", actionId: "Q" }]),
      graph(),
    ]
    const secondSetEdge: FlowEdge = {
      ...(edges()[0] as FlowEdge),
      id: "e3",
      sourceHandle: itemSetHandleId("is-2"),
    }
    const data = {
      ...graph().data,
      graphKind: "resists" as const,
      effective: { view: "killMap" as const },
    }
    const derived = deriveGraphNodeData(
      "graph-1",
      data,
      nodes,
      [...edges(), secondSetEdge],
      snapshot,
    )

    expect(derived.variantOptions.map((option) => option.label)).toEqual([
      "Combo 1 · IE",
      "Combo 1 · No items",
    ])
    expect(derived.killMapA?.label).toBe("Combo 1 · IE")
    expect(derived.killMapB?.label).toBe("Combo 1 · No items")
    const map = derived.killMap
    expect(map?.cells).toHaveLength((map?.resists.length ?? 0) * (map?.hps.length ?? 0))
    expect(map?.cells.some((cell) => cell.outcome === "onlyB")).toBe(false)
    expect(map?.markers[0]).toMatchObject({ resist: 0, hp: 1000, name: "Squishy" })
  })
})
