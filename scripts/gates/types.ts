/** Shared types for the `data:gates` pipeline (plan §3.3.2, §7 Phase 6). */

export type FailingEntity = {
  readonly kind: "champion" | "item"
  readonly id: string
  readonly name: string
  readonly reason: string
}

export type GateOutcome = {
  readonly name: string
  readonly passed: boolean
  readonly summary: string
  readonly failingEntities: readonly FailingEntity[]
}

export function gatePass(name: string, summary: string): GateOutcome {
  return { name, passed: true, summary, failingEntities: [] }
}

export function gateFail(
  name: string,
  summary: string,
  failingEntities: readonly FailingEntity[] = [],
): GateOutcome {
  return { name, passed: false, summary, failingEntities }
}

export type GateReport = {
  readonly patch: string
  readonly baseline: string | null
  readonly generatedAt: string
  readonly gates: readonly GateOutcome[]
  readonly passed: boolean
  readonly failingEntities: readonly FailingEntity[]
}

export function renderGateReportMarkdown(report: GateReport): string {
  const lines: string[] = [
    `# Gate report — ${report.patch}${report.baseline !== null ? ` (baseline ${report.baseline})` : ""}`,
    "",
    report.passed ? "**Result: PASS**" : "**Result: FAIL**",
    "",
    "| Gate | Result | Summary |",
    "|---|---|---|",
  ]
  for (const gate of report.gates) {
    lines.push(`| ${gate.name} | ${gate.passed ? "pass" : "FAIL"} | ${gate.summary} |`)
  }
  if (report.failingEntities.length > 0) {
    lines.push(
      "",
      "## Failing modeled entities",
      "",
      "| Kind | Id | Name | Reason |",
      "|---|---|---|---|",
    )
    for (const entity of report.failingEntities) {
      lines.push(`| ${entity.kind} | ${entity.id} | ${entity.name} | ${entity.reason} |`)
    }
  }
  return lines.join("\n")
}
