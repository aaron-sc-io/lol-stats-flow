import { useState } from "react"
import { DamageTypeChip } from "@/components/DamageTypeChip"
import { Icon } from "@/components/icons"
import type { ComparisonRow } from "@/graph/comparison-row"
import { cx } from "@/lib/cx"
import styles from "./GraphNode.module.css"

type SortKey =
  | "comboName"
  | "variantName"
  | "targetName"
  | "total"
  | "percentHp"
  | "killed"
  | "overkill"
  | "durationSeconds"
  | "dps"
type SortDirection = "asc" | "desc"
type SortState = { readonly key: SortKey; readonly direction: SortDirection } | null

const COLUMNS: ReadonlyArray<{ readonly key: SortKey; readonly label: string }> = [
  { key: "comboName", label: "Combo" },
  { key: "variantName", label: "Items" },
  { key: "targetName", label: "Target" },
  { key: "total", label: "Total" },
  { key: "percentHp", label: "% HP" },
  { key: "killed", label: "Kill" },
  { key: "overkill", label: "Overkill" },
  { key: "durationSeconds", label: "Duration" },
  { key: "dps", label: "DPS" },
]

function compareBy(a: ComparisonRow, b: ComparisonRow, key: SortKey): number {
  const left = a[key]
  const right = b[key]
  if (typeof left === "number" && typeof right === "number") {
    return left - right
  }
  if (typeof left === "boolean" && typeof right === "boolean") {
    return Number(left) - Number(right)
  }
  return String(left).localeCompare(String(right))
}

/** Pure sort step — exported for unit testing independent of rendering. */
export function sortRows(
  rows: readonly ComparisonRow[],
  sort: SortState,
): readonly ComparisonRow[] {
  if (sort === null) {
    return rows
  }
  const sorted = [...rows].sort((a, b) => compareBy(a, b, sort.key))
  return sort.direction === "asc" ? sorted : sorted.reverse()
}

/** Toggles a column's sort: none → asc → desc → none, resetting to asc
 * when a different column is clicked. */
export function nextSortState(current: SortState, key: SortKey): SortState {
  if (current?.key !== key) {
    return { key, direction: "asc" }
  }
  return current.direction === "asc" ? { key, direction: "desc" } : null
}

function killLabel(row: ComparisonRow): string {
  if (!row.killed) {
    return "No"
  }
  const step = row.killStepLabel?.replace("Step ", "") ?? "?"
  return `Yes (${step})`
}

function SortableHeader({
  column,
  sort,
  onSort,
}: {
  readonly column: (typeof COLUMNS)[number]
  readonly sort: SortState
  readonly onSort: (key: SortKey) => void
}) {
  const activeSort = sort !== null && sort.key === column.key ? sort : null
  return (
    <th
      aria-sort={
        activeSort === null ? "none" : activeSort.direction === "asc" ? "ascending" : "descending"
      }
    >
      <button type="button" className={styles.sortButton} onClick={() => onSort(column.key)}>
        {column.label}
        <Icon
          name="chevron-down"
          size={16}
          className={cx(
            styles.sortIcon,
            activeSort !== null && styles.sortIconActive,
            activeSort !== null && activeSort.direction === "asc" && styles.sortIconAsc,
          )}
        />
      </button>
    </th>
  )
}

/**
 * Comparison table (plan D12, deliverable 5): one row per combo × item-set
 * variant × target,
 * sortable by clicking any column header. The phys/magic/true split is one
 * "Damage" column of compact chips (plan Phase 4b defect fix — 3 separate
 * columns overflowed the node) instead of 3; `Total` stays the first
 * `.num`-classed cell so it keeps anchoring existing e2e selectors.
 */
export function ComparisonTable({ rows }: { readonly rows: readonly ComparisonRow[] }) {
  const [sort, setSort] = useState<SortState>(null)

  if (rows.length === 0) {
    return <p className={styles.emptyState}>Connect a combo to compare damage.</p>
  }

  const displayRows = sortRows(rows, sort)

  return (
    <table className={styles.table}>
      <thead>
        <tr>
          {COLUMNS.map((column) => (
            <SortableHeader
              key={column.key}
              column={column}
              sort={sort}
              onSort={(key) => setSort((current) => nextSortState(current, key))}
            />
          ))}
          <th>Damage</th>
        </tr>
      </thead>
      <tbody>
        {displayRows.map((row) => (
          <tr key={`${row.comboId}-${row.variantId}-${row.targetId}`}>
            <td>{row.comboName}</td>
            <td>{row.variantName}</td>
            <td>{row.targetName}</td>
            <td className="num">{Math.round(row.total).toLocaleString()}</td>
            <td className="num">{row.percentHp.toFixed(1)}%</td>
            <td>{killLabel(row)}</td>
            <td className="num">{Math.round(row.overkill).toLocaleString()}</td>
            <td className="num">{row.durationSeconds.toFixed(2)}s</td>
            <td className="num">{Math.round(row.dps).toLocaleString()}</td>
            <td>
              <div className={styles.damageCluster}>
                <DamageTypeChip type="physical">
                  {Math.round(row.physical).toLocaleString()}
                </DamageTypeChip>
                <DamageTypeChip type="magic">
                  {Math.round(row.magic).toLocaleString()}
                </DamageTypeChip>
                <DamageTypeChip type="true">{Math.round(row.true).toLocaleString()}</DamageTypeChip>
              </div>
            </td>
          </tr>
        ))}
      </tbody>
    </table>
  )
}
