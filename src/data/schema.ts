/**
 * Single source of truth for the build-time data snapshot shape, consumed by
 * `scripts/data/normalize.ts` (producer) and `src/data/loader.ts` + the Phase 2
 * engine (consumers). Implementation is split across sibling modules to stay
 * under the 250-LOC-per-file ceiling; this file is the one stable import path.
 */

export {
  type FormulaNode,
  FormulaNodeSchema,
  type GameCalculation,
  GameCalculationSchema,
} from "./formula-schema"
export {
  type AbilityData,
  AbilityDataSchema,
  type AbilitySlot,
  type ChampionData,
  ChampionDataSchema,
  type ChampionStats,
  ChampionStatsSchema,
  type ItemData,
  ItemDataSchema,
  type ItemPassiveActive,
  ItemPassiveActiveSchema,
  SNAPSHOT_SCHEMA_VERSION,
  type Snapshot,
  type SnapshotMeta,
  SnapshotMetaSchema,
  SnapshotSchema,
} from "./snapshot-schema"
export {
  resolveStatId,
  STAT_FORMULA_KINDS,
  STAT_IDS,
  type StatFormulaKind,
  statFormulaKindFromId,
} from "./stat-ids"
