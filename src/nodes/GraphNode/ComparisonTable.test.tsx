import { describe, expect, it } from "vitest"
import type { ComparisonRow } from "@/graph/comparison-row"
import { nextSortState, sortRows } from "./ComparisonTable"

function row(overrides: Partial<ComparisonRow> = {}): ComparisonRow {
  return {
    comboId: "combo-1",
    comboName: "Combo 1",
    variantId: "is-1",
    variantName: "Infinity Edge",
    targetId: "t1",
    targetName: "Target 1",
    total: 100,
    percentHp: 10,
    killed: false,
    killStepLabel: null,
    killTimeSeconds: null,
    overkill: 0,
    durationSeconds: 1,
    dps: 100,
    physical: 100,
    magic: 0,
    true: 0,
    ...overrides,
  }
}

describe("sortRows", () => {
  it("given a null sort state, when sorting, then the original order is preserved", () => {
    const rows = [row({ comboName: "B" }), row({ comboName: "A" })]
    expect(sortRows(rows, null).map((r) => r.comboName)).toEqual(["B", "A"])
  })

  it("given an ascending numeric sort, when sorting by total, then rows order smallest to largest", () => {
    const rows = [row({ total: 300 }), row({ total: 100 }), row({ total: 200 })]
    const sorted = sortRows(rows, { key: "total", direction: "asc" })
    expect(sorted.map((r) => r.total)).toEqual([100, 200, 300])
  })

  it("given a descending sort, when sorting by total, then rows order largest to smallest", () => {
    const rows = [row({ total: 100 }), row({ total: 300 }), row({ total: 200 })]
    const sorted = sortRows(rows, { key: "total", direction: "desc" })
    expect(sorted.map((r) => r.total)).toEqual([300, 200, 100])
  })

  it("given a string column, when sorting by comboName ascending, then rows sort alphabetically", () => {
    const rows = [
      row({ comboName: "Charlie" }),
      row({ comboName: "Alpha" }),
      row({ comboName: "Bravo" }),
    ]
    const sorted = sortRows(rows, { key: "comboName", direction: "asc" })
    expect(sorted.map((r) => r.comboName)).toEqual(["Alpha", "Bravo", "Charlie"])
  })

  it("given a boolean column, when sorting by killed ascending, then false sorts before true", () => {
    const rows = [
      row({ killed: true, comboName: "killer" }),
      row({ killed: false, comboName: "survivor" }),
    ]
    const sorted = sortRows(rows, { key: "killed", direction: "asc" })
    expect(sorted.map((r) => r.comboName)).toEqual(["survivor", "killer"])
  })

  it("does not mutate the input array", () => {
    const rows = [row({ total: 300 }), row({ total: 100 })]
    const original = [...rows]
    sortRows(rows, { key: "total", direction: "asc" })
    expect(rows).toEqual(original)
  })
})

describe("nextSortState", () => {
  it("given no current sort, when a column is clicked, then it becomes ascending", () => {
    expect(nextSortState(null, "total")).toEqual({ key: "total", direction: "asc" })
  })

  it("given the same column ascending, when clicked again, then it becomes descending", () => {
    const current = { key: "total" as const, direction: "asc" as const }
    expect(nextSortState(current, "total")).toEqual({ key: "total", direction: "desc" })
  })

  it("given the same column descending, when clicked again, then sort clears to null", () => {
    const current = { key: "total" as const, direction: "desc" as const }
    expect(nextSortState(current, "total")).toBeNull()
  })

  it("given a different column is active, when clicked, then the new column starts ascending", () => {
    const current = { key: "total" as const, direction: "desc" as const }
    expect(nextSortState(current, "dps")).toEqual({ key: "dps", direction: "asc" })
  })
})
