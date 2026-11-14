/**
 * Gate 2 (structural) + Gate 3 (coverage non-regression) — plan §3.3.2:
 * "structural guard: every modeled champion/item still compiles all bound
 * formulas, no previously-bound calc became unknown, no modeled entity lost
 * calcs" and "coverage must not drop for modeled entities". Both compare the
 * candidate patch's `coverage.json` (written by `scripts/data/coverage.ts`
 * during `data:sync`) against a baseline patch's `coverage.json` — the last
 * known-good snapshot, i.e. `data/current.json`'s value *before* this sync
 * ran. A champion/item that was modeled in the baseline but is absent from
 * the candidate is itself a structural failure (data source dropped it).
 */
import { join } from "node:path"
import type { EntityCoverage } from "../data/coverage"
import { readTextFileIfExists } from "../data/fs-cache"
import { snapshotDir } from "../data/paths"
import { type FailingEntity, type GateOutcome, gateFail, gatePass } from "./types"

type CoverageReport = {
  readonly champions: readonly EntityCoverage[]
  readonly items: readonly EntityCoverage[]
}

function readCoverage(patch: string): CoverageReport | null {
  const text = readTextFileIfExists(join(snapshotDir(patch), "coverage.json"))
  return text === null ? null : (JSON.parse(text) as CoverageReport)
}

function entityKind(report: CoverageReport, id: string): "champion" | "item" {
  return report.champions.some((c) => c.id === id) ? "champion" : "item"
}

function allModeled(report: CoverageReport): readonly EntityCoverage[] {
  return [...report.champions, ...report.items].filter((e) => e.modeled)
}

/** `null` baseline (first-ever patch, or baseline snapshot pruned/missing)
 * means nothing to regress against — both gates vacuously pass. */
export function runStructuralGate(patch: string, baseline: string | null): GateOutcome {
  const candidate = readCoverage(patch)
  if (candidate === null) {
    return gateFail("structural", `coverage.json missing for candidate patch ${patch}`)
  }
  const baselineReport = baseline === null ? null : readCoverage(baseline)
  if (baselineReport === null) {
    return gatePass("structural", "no baseline snapshot to compare against (first sync)")
  }

  const failing: FailingEntity[] = []
  for (const before of allModeled(baselineReport)) {
    const after = [...candidate.champions, ...candidate.items].find((e) => e.id === before.id)
    const kind = entityKind(baselineReport, before.id)
    if (after === undefined) {
      failing.push({
        kind,
        id: before.id,
        name: before.name,
        reason: "modeled entity disappeared from new patch",
      })
      continue
    }
    if (!after.modeled) {
      // Already demoted upstream (e.g. by a previous auto-demotion pass
      // whose override carried forward) — not a new structural failure.
      continue
    }
    if (after.calculationCount < before.calculationCount) {
      failing.push({
        kind,
        id: before.id,
        name: before.name,
        reason: `lost calculations: ${before.calculationCount} → ${after.calculationCount}`,
      })
      continue
    }
    if (after.unknownPartCount > before.unknownPartCount) {
      failing.push({
        kind,
        id: before.id,
        name: before.name,
        reason: `a previously-bound calculation became unknown: unknownPartCount ${before.unknownPartCount} → ${after.unknownPartCount}`,
      })
    }
  }

  if (failing.length > 0) {
    return gateFail(
      "structural",
      `${failing.length} modeled entity(ies) regressed structurally`,
      failing,
    )
  }
  return gatePass(
    "structural",
    `${allModeled(baselineReport).length} modeled entities unchanged or improved`,
  )
}

export function runCoverageGate(patch: string, baseline: string | null): GateOutcome {
  const candidate = readCoverage(patch)
  if (candidate === null) {
    return gateFail("coverage", `coverage.json missing for candidate patch ${patch}`)
  }
  const baselineReport = baseline === null ? null : readCoverage(baseline)
  if (baselineReport === null) {
    return gatePass("coverage", "no baseline snapshot to compare against (first sync)")
  }

  const failing: FailingEntity[] = []
  for (const before of allModeled(baselineReport)) {
    const after = [...candidate.champions, ...candidate.items].find((e) => e.id === before.id)
    if (after === undefined || !after.modeled) {
      continue // already reported by the structural gate
    }
    const boundBefore = before.calculationCount - before.unknownPartCount
    const boundAfter = after.calculationCount - after.unknownPartCount
    if (boundAfter < boundBefore) {
      failing.push({
        kind: entityKind(baselineReport, before.id),
        id: before.id,
        name: before.name,
        reason: `bound-calculation coverage dropped: ${boundBefore} → ${boundAfter}`,
      })
    }
  }

  if (failing.length > 0) {
    return gateFail(
      "coverage",
      `${failing.length} modeled entity(ies) lost bound-calculation coverage`,
      failing,
    )
  }
  return gatePass(
    "coverage",
    `bound-calculation coverage held or improved for ${allModeled(baselineReport).length} modeled entities`,
  )
}
