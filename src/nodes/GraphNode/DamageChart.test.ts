import { describe, expect, it } from "vitest"
import type { ComboSeries } from "@/graph/graph-node-derivation"
import { mergeSeriesForChart } from "./DamageChart"

function stepSeries(targetId: string): ComboSeries {
  const steps = Array.from({ length: 9 }, (_, index) => {
    const step = index + 1
    const x = index
    return {
      x,
      xLabel: `Step ${step}`,
      physical: 100 + step,
      magic: 0,
      true: 0,
      total: 100 + step,
      cumulative: (100 + step) * step,
      targetHpAfter: 2000 - step * 50,
      stepId: `s${step}`,
      instances: [],
    }
  })

  return {
    seriesId: `combo-1__${targetId}`,
    comboId: "combo-1",
    comboName: "Combo 1",
    variantId: "is-1",
    variantName: "Infinity Edge",
    targetId,
    targetName: `Target ${targetId}`,
    itemSetIds: ["is-1"],
    stepIds: steps.map((step) => String(step.stepId)),
    points: [
      steps[2],
      steps[5],
      steps[8],
      steps[1],
      steps[4],
      steps[7],
      steps[0],
      steps[3],
      steps[6],
    ].flatMap((step) => (step === undefined ? [] : [step])),
  }
}

function tickSeries(targetId: string): ComboSeries {
  return {
    seriesId: `combo-1__${targetId}`,
    comboId: "combo-1",
    comboName: "Combo 1",
    variantId: "is-1",
    variantName: "Infinity Edge",
    targetId,
    targetName: `Target ${targetId}`,
    itemSetIds: ["is-1"],
    stepIds: ["s1", "s2", "s3"],
    points: [
      {
        x: 0.75,
        xLabel: "0.75s",
        physical: 30,
        magic: 0,
        true: 0,
        total: 30,
        cumulative: 90,
        targetHpAfter: 1870,
        instances: [],
      },
      {
        x: 0,
        xLabel: "0.00s",
        physical: 20,
        magic: 0,
        true: 0,
        total: 20,
        cumulative: 20,
        targetHpAfter: 1980,
        instances: [],
      },
      {
        x: 0.25,
        xLabel: "0.25s",
        physical: 25,
        magic: 0,
        true: 0,
        total: 25,
        cumulative: 45,
        targetHpAfter: 1955,
        instances: [],
      },
      {
        x: 0.5,
        xLabel: "0.50s",
        physical: 35,
        magic: 0,
        true: 0,
        total: 35,
        cumulative: 80,
        targetHpAfter: 1920,
        instances: [],
      },
    ],
  }
}

function expectStrictlyIncreasing(values: readonly number[]) {
  for (let index = 1; index < values.length; index += 1) {
    const prev = values[index - 1]
    const next = values[index]
    expect(next).toBeGreaterThan(prev ?? Number.NEGATIVE_INFINITY)
  }
}

describe("mergeSeriesForChart", () => {
  it("Given 4 overlaid step-mode targets with 9 steps, when merged, then x-domain is unique and strictly increasing", () => {
    const merged = mergeSeriesForChart([
      stepSeries("t1"),
      stepSeries("t2"),
      stepSeries("t3"),
      stepSeries("t4"),
    ])

    expect(merged).toHaveLength(9)
    const xValues = merged.map((row) => row.x)
    expectStrictlyIncreasing(xValues)
    expect(new Set(xValues).size).toBe(9)
    expect(merged.map((row) => row.xLabel)).toEqual([
      "Step 1",
      "Step 2",
      "Step 3",
      "Step 4",
      "Step 5",
      "Step 6",
      "Step 7",
      "Step 8",
      "Step 9",
    ])
  })

  it("Given 4 overlaid targets in tick mode, when merged, then x-domain is unique and strictly increasing", () => {
    const merged = mergeSeriesForChart([
      tickSeries("t1"),
      tickSeries("t2"),
      tickSeries("t3"),
      tickSeries("t4"),
    ])

    expect(merged).toHaveLength(4)
    const xValues = merged.map((row) => row.x)
    expectStrictlyIncreasing(xValues)
    expect(new Set(xValues).size).toBe(4)
    expect(merged.map((row) => row.xLabel)).toEqual(["0.00s", "0.25s", "0.50s", "0.75s"])
  })

  it("Given HP-chart rows from 4 overlaid step-mode targets, when merged, then x-domain remains unique and strictly increasing", () => {
    const merged = mergeSeriesForChart([
      stepSeries("t1"),
      stepSeries("t2"),
      stepSeries("t3"),
      stepSeries("t4"),
    ])

    const xValues = merged.map((row) => row.x)
    expectStrictlyIncreasing(xValues)
    expect(new Set(xValues).size).toBe(9)
    expect(
      merged.every((row) =>
        ["combo-1__t1", "combo-1__t2", "combo-1__t3", "combo-1__t4"].every(
          (seriesId) => typeof row[`${seriesId}.targetHpAfter`] === "number",
        ),
      ),
    ).toBe(true)
  })
})
