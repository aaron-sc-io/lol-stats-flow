import { join } from "node:path"
import { describe, expect, it } from "vitest"
import { findTokenViolations } from "./lint-tokens"

const FIXTURES_ROOT = join(import.meta.dirname, "__fixtures__", "token-lint")

describe("findTokenViolations", () => {
  it("flags hex colors, color functions, and raw font-size declarations in a violating fixture", () => {
    const violations = findTokenViolations(join(FIXTURES_ROOT, "violating"))

    const rules = violations.map((violation) => violation.rule)
    expect(rules).toContain("hex-color")
    expect(rules).toContain("color-function")
    expect(rules).toContain("raw-font-size")
    expect(violations.length).toBeGreaterThanOrEqual(5)
  })

  it("passes a clean fixture, including an exempted styles/tokens.css", () => {
    const violations = findTokenViolations(join(FIXTURES_ROOT, "clean"))

    expect(violations).toEqual([])
  })
})
