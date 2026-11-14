import { z } from "zod"

/**
 * FormulaNode — a discriminated union mirroring CDragon's `IGameCalculationPart`
 * hierarchy (see https://meta-wiki.leaguetoolkit.dev/classes/igamecalculationpart).
 * Only the part kinds actually required by the 5 modeled champions + 12 modeled
 * items (verified against live `*.bin.json` dumps on 2026-11-14, patch 16.22)
 * get a precise shape; every other kind is preserved losslessly via the
 * `unknown` fallback variant so the normalizer never crashes or drops data.
 */

const baseStatFields = {
  stat: z.number().int(),
  statKey: z.string().nullable(),
  statFormula: z.enum(["total", "base", "bonus"]),
}

export type FormulaNode =
  | { kind: "number"; value: number }
  | { kind: "namedDataValue"; dataValue: string }
  | { kind: "effectValue"; effectIndex: number }
  | {
      kind: "statByNamedDataValue"
      dataValue: string
      stat: number
      statKey: string | null
      statFormula: "total" | "base" | "bonus"
    }
  | {
      kind: "statByCoefficient"
      coefficient: number
      stat: number
      statKey: string | null
      statFormula: "total" | "base" | "bonus"
    }
  | {
      kind: "statBySubPart"
      stat: number
      statKey: string | null
      statFormula: "total" | "base" | "bonus"
      subpart: FormulaNode
    }
  | { kind: "sumOfSubParts"; subparts: FormulaNode[] }
  | { kind: "productOfSubParts"; subparts: FormulaNode[] }
  | { kind: "maxOfSubParts"; subparts: FormulaNode[] }
  | { kind: "minOfSubParts"; subparts: FormulaNode[] }
  | {
      kind: "clampSubParts"
      subpart: FormulaNode
      min?: FormulaNode | undefined
      max?: FormulaNode | undefined
    }
  | { kind: "spellCalculationRef"; calculationKey: string }
  | {
      kind: "byCharLevelInterpolation"
      startValue: FormulaNode
      endValue: FormulaNode
      startLevel: number
      endLevel: number
    }
  | { kind: "byCharLevelBreakpoints"; breakpoints: Array<{ level: number; value: number }> }
  | { kind: "unknown"; type: string; raw: unknown }

const formulaNodeSchema: z.ZodType<FormulaNode> = z.lazy(() =>
  z.discriminatedUnion("kind", [
    z.object({ kind: z.literal("number"), value: z.number() }),
    z.object({ kind: z.literal("namedDataValue"), dataValue: z.string() }),
    z.object({ kind: z.literal("effectValue"), effectIndex: z.number().int() }),
    z.object({
      kind: z.literal("statByNamedDataValue"),
      dataValue: z.string(),
      ...baseStatFields,
    }),
    z.object({
      kind: z.literal("statByCoefficient"),
      coefficient: z.number(),
      ...baseStatFields,
    }),
    z.object({
      kind: z.literal("statBySubPart"),
      ...baseStatFields,
      subpart: formulaNodeSchema,
    }),
    z.object({ kind: z.literal("sumOfSubParts"), subparts: z.array(formulaNodeSchema) }),
    z.object({ kind: z.literal("productOfSubParts"), subparts: z.array(formulaNodeSchema) }),
    z.object({ kind: z.literal("maxOfSubParts"), subparts: z.array(formulaNodeSchema) }),
    z.object({ kind: z.literal("minOfSubParts"), subparts: z.array(formulaNodeSchema) }),
    z.object({
      kind: z.literal("clampSubParts"),
      subpart: formulaNodeSchema,
      min: formulaNodeSchema.optional(),
      max: formulaNodeSchema.optional(),
    }),
    z.object({ kind: z.literal("spellCalculationRef"), calculationKey: z.string() }),
    z.object({
      kind: z.literal("byCharLevelInterpolation"),
      startValue: formulaNodeSchema,
      endValue: formulaNodeSchema,
      startLevel: z.number().int(),
      endLevel: z.number().int(),
    }),
    z.object({
      kind: z.literal("byCharLevelBreakpoints"),
      breakpoints: z.array(z.object({ level: z.number().int(), value: z.number() })),
    }),
    z.object({ kind: z.literal("unknown"), type: z.string(), raw: z.unknown() }),
  ]),
)

export const FormulaNodeSchema = formulaNodeSchema

export const GameCalculationSchema = z.object({
  parts: z.array(formulaNodeSchema),
  multiplier: formulaNodeSchema.optional(),
  precision: z.number().int().optional(),
  displayAsPercent: z.boolean().optional(),
})
export type GameCalculation = z.infer<typeof GameCalculationSchema>
