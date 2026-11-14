import { z } from "zod"

/**
 * FormulaNode — a discriminated union mirroring CDragon's `IGameCalculationPart`
 * hierarchy (see https://meta-wiki.leaguetoolkit.dev/classes/igamecalculationpart).
 * Only the part kinds actually required by the 5 modeled champions + 12 modeled
 * items (verified against live `*.bin.json` dumps on 2026-11-14, patch 16.22)
 * get a precise shape; every other kind is preserved losslessly via the
 * `unknown` fallback variant so the normalizer never crashes or drops data.
 *
 * `byCharLevelBreakpoints`/`byCharLevelInterpolation`/`byCharLevelFormula`
 * field shapes verified against real bin JSON (Yasuo/Brand/Darius/Garen) plus
 * the reverse-engineered algorithm documented in
 * https://github.com/WordlessMeteor/LoL-DIY-Programs (commit 4ced6f1,
 * "Correction of Level-Scaling Algorithm") and the LeagueToolkit meta-wiki
 * class reference (https://meta-wiki.leaguetoolkit.dev/domains/spells/).
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
      subparts: FormulaNode[]
      floor?: number | undefined
      ceiling?: number | undefined
    }
  | { kind: "spellCalculationRef"; calculationKey: string }
  | {
      kind: "byCharLevelInterpolation"
      startValue: number
      endValue: number
      startLevel: number
      endLevel: number
      scaleByStatProgression: boolean
    }
  | {
      kind: "byCharLevelBreakpoints"
      level1Value: number
      initialBonusPerLevel: number
      breakpoints: Array<{
        level: number
        additionalBonusAtThisLevel?: number | undefined
        bonusPerLevelAtAndAfter?: number | undefined
      }>
    }
  | { kind: "byCharLevelFormula"; values: number[] }
  | { kind: "buffCounterByNamedDataValue"; buffName: string; dataValue: string }
  | { kind: "buffCounterByCoefficient"; buffName: string; coefficient: number }
  | { kind: "abilityResourceByCoefficient"; coefficient: number }
  | { kind: "byItemEpicnessCount"; coefficient: number; epicness: number }
  | { kind: "cooldownMultiplier" }
  | { kind: "unknown"; type: string; raw: unknown }

const breakpointSchema = z.object({
  level: z.number().int(),
  additionalBonusAtThisLevel: z.number().optional(),
  bonusPerLevelAtAndAfter: z.number().optional(),
})

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
      subparts: z.array(formulaNodeSchema),
      floor: z.number().optional(),
      ceiling: z.number().optional(),
    }),
    z.object({ kind: z.literal("spellCalculationRef"), calculationKey: z.string() }),
    z.object({
      kind: z.literal("byCharLevelInterpolation"),
      startValue: z.number(),
      endValue: z.number(),
      startLevel: z.number().int(),
      endLevel: z.number().int(),
      scaleByStatProgression: z.boolean(),
    }),
    z.object({
      kind: z.literal("byCharLevelBreakpoints"),
      level1Value: z.number(),
      initialBonusPerLevel: z.number(),
      breakpoints: z.array(breakpointSchema),
    }),
    z.object({ kind: z.literal("byCharLevelFormula"), values: z.array(z.number()) }),
    z.object({
      kind: z.literal("buffCounterByNamedDataValue"),
      buffName: z.string(),
      dataValue: z.string(),
    }),
    z.object({
      kind: z.literal("buffCounterByCoefficient"),
      buffName: z.string(),
      coefficient: z.number(),
    }),
    z.object({ kind: z.literal("abilityResourceByCoefficient"), coefficient: z.number() }),
    z.object({
      kind: z.literal("byItemEpicnessCount"),
      coefficient: z.number(),
      epicness: z.number(),
    }),
    z.object({ kind: z.literal("cooldownMultiplier") }),
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
