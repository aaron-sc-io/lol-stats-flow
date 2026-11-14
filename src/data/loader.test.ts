import { describe, expect, it } from "vitest"
import { listAvailablePatches } from "./loader"

describe("listAvailablePatches", () => {
  it("lists the patch(es) with a committed snapshot under data/snapshots/", () => {
    // Derived from `import.meta.glob("../../data/snapshots/*/champions.json")`
    // at build time — this repo currently ships exactly one snapshot.
    expect(listAvailablePatches()).toEqual(["16.22.1"])
  })
})
