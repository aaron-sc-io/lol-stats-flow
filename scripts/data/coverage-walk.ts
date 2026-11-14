import type { FormulaNode, GameCalculation } from "../../src/data/formula-schema"

const HASH_TOKEN_PATTERN = /^\{[0-9a-f]{8}\}$/i

export type CalculationStats = {
  unknownPartsByType: Map<string, number>
  unresolvedHashNames: Set<string>
}

function visitNode(node: FormulaNode, stats: CalculationStats): void {
  if (node.kind === "unknown") {
    stats.unknownPartsByType.set(node.type, (stats.unknownPartsByType.get(node.type) ?? 0) + 1)
    if (HASH_TOKEN_PATTERN.test(node.type)) {
      stats.unresolvedHashNames.add(node.type)
    }
    return
  }
  if ("dataValue" in node && HASH_TOKEN_PATTERN.test(node.dataValue)) {
    stats.unresolvedHashNames.add(node.dataValue)
  }
  if ("statKey" in node && node.statKey === null) {
    stats.unresolvedHashNames.add(`mStat:${node.stat}`)
  }
  if ("subpart" in node) {
    visitNode(node.subpart, stats)
  }
  if ("subparts" in node) {
    for (const subpart of node.subparts) {
      visitNode(subpart, stats)
    }
  }
}

export function visitCalculation(calc: GameCalculation, stats: CalculationStats): void {
  for (const part of calc.parts) {
    visitNode(part, stats)
  }
  if (calc.multiplier !== undefined) {
    visitNode(calc.multiplier, stats)
  }
}

export function newCalculationStats(): CalculationStats {
  return { unknownPartsByType: new Map(), unresolvedHashNames: new Set() }
}

export function mergeCalculationStats(target: CalculationStats, source: CalculationStats): void {
  for (const [type, count] of source.unknownPartsByType) {
    target.unknownPartsByType.set(type, (target.unknownPartsByType.get(type) ?? 0) + count)
  }
  for (const name of source.unresolvedHashNames) {
    target.unresolvedHashNames.add(name)
  }
}
