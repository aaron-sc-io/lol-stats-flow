import type { FormulaNode, GameCalculation } from "../../../src/data/formula-schema"
import { resolveStatId, statFormulaKindFromId } from "../../../src/data/stat-ids"
import { type HashTable, resolveHashToken } from "./hash-resolver"

/** Raw CDragon calculation-part JSON shape (loosely typed — fields vary by
 * part kind and this is exactly the boundary we parse defensively). */
export type RawPart = Record<string, unknown>

function asRecord(value: unknown): RawPart | null {
  return value !== null && typeof value === "object" && !Array.isArray(value)
    ? (value as RawPart)
    : null
}

function asPartArray(value: unknown): RawPart[] {
  return Array.isArray(value)
    ? value.filter((entry): entry is RawPart => asRecord(entry) !== null)
    : []
}

function typeOf(raw: RawPart, hashes: HashTable): string {
  const rawType = raw.__type
  return typeof rawType === "string" ? resolveHashToken(rawType, hashes) : "unknown"
}

function statFieldsOf(raw: RawPart) {
  const stat = typeof raw.mStat === "number" ? raw.mStat : -1
  const statFormulaId = typeof raw.mStatFormula === "number" ? raw.mStatFormula : 0
  return { stat, statKey: resolveStatId(stat), statFormula: statFormulaKindFromId(statFormulaId) }
}

/** Builds a single FormulaNode from a raw CDragon calculation-part object.
 * Unrecognized `__type`s (including ones CDragon still ships as a hashed
 * token we couldn't resolve) become `{ kind: "unknown" }`, preserving `raw`
 * so no information is lost and the normalizer never throws. */
export function buildFormulaNode(raw: RawPart, hashes: HashTable): FormulaNode {
  const type = typeOf(raw, hashes)
  switch (type) {
    case "NumberCalculationPart":
      return { kind: "number", value: typeof raw.mNumber === "number" ? raw.mNumber : 0 }
    case "NamedDataValueCalculationPart":
      return {
        kind: "namedDataValue",
        dataValue: typeof raw.mDataValue === "string" ? raw.mDataValue : "",
      }
    case "EffectValueCalculationPart":
      return {
        kind: "effectValue",
        effectIndex: typeof raw.mEffectIndex === "number" ? raw.mEffectIndex : -1,
      }
    case "StatByNamedDataValueCalculationPart":
      return {
        kind: "statByNamedDataValue",
        dataValue: typeof raw.mDataValue === "string" ? raw.mDataValue : "",
        ...statFieldsOf(raw),
      }
    case "StatByCoefficientCalculationPart":
      return {
        kind: "statByCoefficient",
        coefficient: typeof raw.mCoefficient === "number" ? raw.mCoefficient : 0,
        ...statFieldsOf(raw),
      }
    case "StatBySubPartCalculationPart": {
      const subpart = asRecord(raw.mSubpart)
      return {
        kind: "statBySubPart",
        ...statFieldsOf(raw),
        subpart: subpart !== null ? buildFormulaNode(subpart, hashes) : unknownNode(type, raw),
      }
    }
    case "SumOfSubPartsCalculationPart":
      return { kind: "sumOfSubParts", subparts: buildSubparts(raw, hashes) }
    case "ProductOfSubPartsCalculationPart":
      return { kind: "productOfSubParts", subparts: buildSubparts(raw, hashes) }
    case "MaxOfSubPartsCalculationPart":
      return { kind: "maxOfSubParts", subparts: buildSubparts(raw, hashes) }
    case "MinOfSubPartsCalculationPart":
      return { kind: "minOfSubParts", subparts: buildSubparts(raw, hashes) }
    default:
      if (typeof raw.mSpellCalculationKey === "string") {
        return { kind: "spellCalculationRef", calculationKey: raw.mSpellCalculationKey }
      }
      return unknownNode(type, raw)
  }
}

function buildSubparts(raw: RawPart, hashes: HashTable): FormulaNode[] {
  return asPartArray(raw.mSubparts).map((part) => buildFormulaNode(part, hashes))
}

function unknownNode(type: string, raw: RawPart): FormulaNode {
  return { kind: "unknown", type, raw }
}

/** Builds a `GameCalculation` (the top-level `mSpellCalculations[name]` /
 * `mItemCalculations[name]` value) from its raw CDragon shape. */
export function buildGameCalculation(raw: RawPart, hashes: HashTable): GameCalculation {
  const parts = asPartArray(raw.mFormulaParts).map((part) => buildFormulaNode(part, hashes))
  const multiplier = asRecord(raw.mMultiplier)
  return {
    parts,
    ...(multiplier !== null ? { multiplier: buildFormulaNode(multiplier, hashes) } : {}),
    ...(typeof raw.mPrecision === "number" ? { precision: raw.mPrecision } : {}),
    ...(typeof raw.mDisplayAsPercent === "boolean"
      ? { displayAsPercent: raw.mDisplayAsPercent }
      : {}),
  }
}

export function buildCalculationMap(
  raw: unknown,
  hashes: HashTable,
): Record<string, GameCalculation> {
  const record = asRecord(raw)
  if (record === null) {
    return {}
  }
  const result: Record<string, GameCalculation> = {}
  for (const [name, value] of Object.entries(record)) {
    const valueRecord = asRecord(value)
    if (valueRecord !== null) {
      result[name] = buildGameCalculation(valueRecord, hashes)
    }
  }
  return result
}
