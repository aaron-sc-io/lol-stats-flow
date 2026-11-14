import { describe, expect, it } from "vitest"
import { defaultRankForLevel } from "./default-rank"

describe("defaultRankForLevel", () => {
  it("ramps a basic ability (Q/W/E) up roughly every other level", () => {
    // Given a 5-rank basic ability
    // When evaluated across the early levels
    // Then rank 1 unlocks at level 1 and rank 5 is reached by level 9
    expect(defaultRankForLevel("Q", 1, 5)).toBe(1)
    expect(defaultRankForLevel("Q", 2, 5)).toBe(1)
    expect(defaultRankForLevel("Q", 3, 5)).toBe(2)
    expect(defaultRankForLevel("Q", 9, 5)).toBe(5)
    expect(defaultRankForLevel("Q", 18, 5)).toBe(5)
  })

  it("never exceeds maxRank even at level 18", () => {
    expect(defaultRankForLevel("W", 18, 5)).toBe(5)
  })

  it("gates the ultimate (R) to the standard 6/11/16 unlock levels", () => {
    // Given a 3-rank ultimate
    expect(defaultRankForLevel("R", 1, 3)).toBe(1) // not yet unlocked, but a combo step needs a valid rank
    expect(defaultRankForLevel("R", 5, 3)).toBe(1)
    expect(defaultRankForLevel("R", 6, 3)).toBe(1)
    expect(defaultRankForLevel("R", 10, 3)).toBe(1)
    expect(defaultRankForLevel("R", 11, 3)).toBe(2)
    expect(defaultRankForLevel("R", 15, 3)).toBe(2)
    expect(defaultRankForLevel("R", 16, 3)).toBe(3)
    expect(defaultRankForLevel("R", 18, 3)).toBe(3)
  })

  it("returns 0 for a maxRank of 0 (ability has no ranks)", () => {
    expect(defaultRankForLevel("Q", 11, 0)).toBe(0)
  })
})
