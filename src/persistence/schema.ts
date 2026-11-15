import { z } from "zod"

/**
 * The persisted canvas document (plan D14 deliverable 1): a Zod-validated,
 * versioned projection of the graph store's canonical state
 * (`src/graph/store-helpers.ts`'s `toCanonicalGraph`) plus the metadata
 * the drawer/autosave/share-URL/patch-pin features need. This schema is
 * the single source of truth for "what a saved canvas looks like" — every
 * read path (`storage.ts`, `share-url.ts`, JSON import) runs untrusted
 * input through it exactly once, at the boundary, via `migrations.ts`.
 *
 * Deliberately NOT importing `@/graph/types`' `ChampionNodeData` etc. as
 * schemas directly — Zod schemas are the runtime source of truth here,
 * graph/ is the compile-time source of truth there, and the two are kept
 * independently correct (graph/ must never import persistence/, so the
 * dependency can only run this direction). `schema.test.ts`'s round-trip
 * test is what actually proves the two stay in sync: it runs a real
 * `createDefaultCanvas()` through this schema and back.
 */

export const CANVAS_SCHEMA_VERSION = 1 as const

const PositionSchema = z.object({ x: z.number(), y: z.number() })

const ItemSlotValueSchema = z.number().int().nullable()

const RankOverridesSchema = z
  .object({ Q: z.number(), W: z.number(), E: z.number(), R: z.number() })
  .partial()

const ItemSetSchema = z.object({
  id: z.string(),
  name: z.string(),
  items: z.tuple([
    ItemSlotValueSchema,
    ItemSlotValueSchema,
    ItemSlotValueSchema,
    ItemSlotValueSchema,
    ItemSlotValueSchema,
    ItemSlotValueSchema,
  ]),
  rankOverrides: RankOverridesSchema,
})

const ChampionNodeDataSchema = z.object({
  championId: z.string(),
  level: z.number().int().min(1).max(20),
  itemSets: z.array(ItemSetSchema),
})

const ComboStepSchema = z.object({
  id: z.string(),
  sourceId: z.string(),
  actionId: z.string(),
  rankOverride: z.number().optional(),
  delayMs: z.number().optional(),
})

const ComboNodeDataSchema = z.object({
  name: z.string(),
  steps: z.array(ComboStepSchema),
  collapsedSections: z.array(z.string()),
})

const TargetSpecSchema = z.object({
  id: z.string(),
  name: z.string(),
  maxHp: z.number(),
  currentHp: z.number().optional(),
  bonusHp: z.number(),
  armor: z.number(),
  magicResist: z.number(),
  bonusArmor: z.number().optional(),
  bonusMagicResist: z.number().optional(),
})

// "bars" (per-step bars) was removed as a chart option; canvases saved or
// shared before then still parse, landing on the cumulative chart instead.
const ChartTypeSchema = z
  .enum(["bars", "cumulative", "hp"])
  .transform((value) => (value === "bars" ? "cumulative" : value))
const XModeSchema = z.enum(["step", "tick"])
const SeriesDashStyleSchema = z.enum(["solid", "dashed", "dotted"])

const SeriesOverrideSchema = z.object({
  color: z.string().optional(),
  strokeWidth: z.number().optional(),
  dashStyle: SeriesDashStyleSchema.optional(),
  shape: z.enum(["circle", "square", "diamond"]).optional(),
  hidden: z.boolean().optional(),
})

const GraphNodeDataSchema = z
  .object({
    graphKind: z.enum(["targets", "resists"]).optional(),
    effective: z
      .object({
        resistAxis: z.enum(["armor", "magicResist"]).optional(),
        view: z.enum(["curves", "killMap"]).optional(),
        killMapA: z.string().optional(),
        killMapB: z.string().optional(),
      })
      .optional(),
    targets: z.array(TargetSpecSchema),
    activeTargetIds: z.array(z.string()).optional(),
    // Backward-compat: legacy canvases stored a single active target.
    activeTargetId: z.string().optional(),
    chartType: ChartTypeSchema,
    xMode: XModeSchema,
    seriesOverrides: z.record(z.string(), SeriesOverrideSchema).optional(),
  })
  .transform((value) => {
    const validTargetIds = new Set(value.targets.map((target) => target.id))
    const legacyActiveTargetIds = value.activeTargetId === undefined ? [] : [value.activeTargetId]
    const rawActiveTargetIds = value.activeTargetIds ?? legacyActiveTargetIds
    const activeTargetIds = rawActiveTargetIds.filter((targetId, index, all) => {
      if (!validTargetIds.has(targetId)) {
        return false
      }
      return all.indexOf(targetId) === index
    })
    const normalizedActiveTargetIds =
      activeTargetIds.length > 0
        ? activeTargetIds
        : value.targets[0]?.id === undefined
          ? []
          : [value.targets[0].id]
    return {
      ...(value.graphKind === undefined ? {} : { graphKind: value.graphKind }),
      ...(value.effective === undefined ? {} : { effective: value.effective }),
      targets: value.targets,
      activeTargetIds: normalizedActiveTargetIds,
      chartType: value.chartType,
      xMode: value.xMode,
      ...(value.seriesOverrides === undefined || Object.keys(value.seriesOverrides).length === 0
        ? {}
        : { seriesOverrides: value.seriesOverrides }),
    }
  })

export const PersistedNodeSchema = z.discriminatedUnion("type", [
  z.object({
    id: z.string(),
    type: z.literal("champion"),
    position: PositionSchema,
    data: ChampionNodeDataSchema,
  }),
  z.object({
    id: z.string(),
    type: z.literal("combo"),
    position: PositionSchema,
    data: ComboNodeDataSchema,
  }),
  z.object({
    id: z.string(),
    type: z.literal("graph"),
    position: PositionSchema,
    data: GraphNodeDataSchema,
  }),
  // Added after v1 shipped; a new union member only widens what parses, so
  // every existing saved canvas / share link still parses unchanged.
  z.object({
    id: z.string(),
    type: z.literal("tutorial"),
    position: PositionSchema,
    data: z.object({ step: z.number().int().min(0) }),
  }),
])

export const PersistedEdgeSchema = z.object({
  id: z.string(),
  source: z.string(),
  sourceHandle: z.string().nullable(),
  target: z.string(),
  targetHandle: z.string().nullable(),
  type: z.literal("flow"),
})

export const PersistedGraphSchema = z.object({
  nodes: z.array(PersistedNodeSchema),
  edges: z.array(PersistedEdgeSchema),
})

/** The full saved-canvas shape. `patch` is the snapshot patch this canvas
 * was created with/last reconciled against (plan D14 "per-canvas patch
 * pin" — `src/persistence/patch-pin.ts` decides what to do when it no
 * longer matches the running app's current patch). */
export const CanvasDocumentSchema = z.object({
  schemaVersion: z.literal(CANVAS_SCHEMA_VERSION),
  id: z.string(),
  name: z.string(),
  patch: z.string(),
  createdAt: z.string(),
  updatedAt: z.string(),
  graph: PersistedGraphSchema,
})

export type CanvasDocument = z.infer<typeof CanvasDocumentSchema>
export type PersistedNode = z.infer<typeof PersistedNodeSchema>
export type PersistedEdge = z.infer<typeof PersistedEdgeSchema>
export type PersistedGraph = z.infer<typeof PersistedGraphSchema>

/** A document fields minus the per-save-slot identity/timestamps — what a
 * share URL encodes (plan D14 deliverable 1: decoding one always creates a
 * *new* unsaved canvas, so `id`/`createdAt`/`updatedAt` are re-stamped
 * fresh at decode time rather than carried over the wire). */
export const ShareableDocumentSchema = CanvasDocumentSchema.omit({
  id: true,
  createdAt: true,
  updatedAt: true,
})
export type ShareableDocument = z.infer<typeof ShareableDocumentSchema>
