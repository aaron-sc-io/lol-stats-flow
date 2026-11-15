import { describe, expect, it } from "vitest"
import {
  assessRisks,
  bumpVersion,
  decideBump,
  parseCommit,
  type RiskInputs,
  renderReport,
  verdictOf,
} from "./report"

const base: RiskInputs = {
  commits: [parseCommit("a".repeat(40), "fix(ui): thing", "")],
  changes: [],
  canvasSchemaVersion: { before: "1", after: "1" },
  snapshotSchemaVersion: { before: "1", after: "1" },
  dependencies: { before: { react: "^19.0.0" }, after: { react: "^19.1.0" } },
}

describe("parseCommit", () => {
  it("parses type, scope, subject and breaking markers", () => {
    expect(parseCommit("h", "feat(graph)!: new edges", "")).toMatchObject({
      type: "feat",
      scope: "graph",
      subject: "new edges",
      breaking: true,
    })
    expect(parseCommit("h", "fix: x", "BREAKING CHANGE: y").breaking).toBe(true)
    expect(parseCommit("h", "Merge stuff", "").type).toBe("other")
  })
})

describe("decideBump / bumpVersion", () => {
  const fix = parseCommit("h", "fix: a", "")
  const feat = parseCommit("h", "feat: a", "")
  const breaking = parseCommit("h", "feat!: a", "")

  it("follows conventional commits, pre-1.0 breaking = minor", () => {
    expect(decideBump([fix], "1.2.3")).toBe("patch")
    expect(decideBump([fix, feat], "1.2.3")).toBe("minor")
    expect(decideBump([breaking], "1.2.3")).toBe("major")
    expect(decideBump([breaking], "0.2.0")).toBe("minor")
  })

  it("bumps semver", () => {
    expect(bumpVersion("0.2.0", "patch")).toBe("0.2.1")
    expect(bumpVersion("0.2.5", "minor")).toBe("0.3.0")
    expect(bumpVersion("1.2.3", "major")).toBe("2.0.0")
  })
})

describe("assessRisks", () => {
  it("is SAFE for a plain fix with minor dep updates", () => {
    expect(verdictOf(assessRisks(base))).toBe("SAFE")
  })

  it("flags persistence changes without a schema bump", () => {
    const risks = assessRisks({
      ...base,
      changes: [{ status: "M", path: "src/persistence/schema.ts" }],
    })
    expect(risks).toContainEqual(
      expect.objectContaining({ check: "canvas schema", severity: "attention" }),
    )
  })

  it("accepts a schema bump that ships a migration and a new fixture", () => {
    const risks = assessRisks({
      ...base,
      canvasSchemaVersion: { before: "1", after: "2" },
      changes: [
        { status: "M", path: "src/persistence/schema.ts" },
        { status: "M", path: "src/persistence/migrations.ts" },
        { status: "A", path: "src/persistence/__fixtures__/canvas-v1.ts" },
      ],
    })
    expect(verdictOf(risks)).toBe("SAFE")
  })

  it("flags edited frozen fixtures, snapshot schema bumps and major deps", () => {
    const risks = assessRisks({
      ...base,
      changes: [{ status: "M", path: "src/engine/__golden__/fixtures/16.22.1/items.json" }],
      snapshotSchemaVersion: { before: "1", after: "2" },
      dependencies: { before: { vite: "^7.0.0" }, after: { vite: "^8.0.0" } },
    })
    expect(risks.filter((r) => r.severity === "attention").map((r) => r.check)).toEqual([
      "frozen fixtures",
      "snapshot schema",
      "dependencies",
    ])
  })

  it("flags an empty release", () => {
    expect(verdictOf(assessRisks({ ...base, commits: [] }))).toBe("NEEDS ATTENTION")
  })
})

describe("renderReport", () => {
  it("renders the verdict, version line and grouped changes", () => {
    const report = renderReport({
      fromTag: "v0.2.0",
      currentVersion: "0.2.0",
      nextVersion: "0.2.1",
      bump: "patch",
      suggestedBump: "patch",
      date: "2026-11-15T00:00:00.000Z",
      commits: base.commits,
      risks: [],
      changedFiles: 3,
    })
    expect(report).toContain("**Verdict: SAFE**")
    expect(report).toContain("0.2.0 → **0.2.1**")
    expect(report).toContain("### Fixes")
    expect(report).toContain("- **ui:** thing (aaaaaaa)")
  })
})
