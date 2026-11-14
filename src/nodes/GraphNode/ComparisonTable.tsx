import { DamageTypeChip } from "@/components/DamageTypeChip"
import type { ComparisonRow } from "@/graph/comparison-row"
import styles from "./GraphNode.module.css"

/**
 * Comparison table (plan D12, deliverable 5): one row per combo × target.
 * Functional now — sortable columns and refined styling are Phase 4b.
 */
export function ComparisonTable({ rows }: { readonly rows: readonly ComparisonRow[] }) {
  if (rows.length === 0) {
    return <p className={styles.emptyState}>Connect a combo to compare damage.</p>
  }

  return (
    <table className={styles.table}>
      <thead>
        <tr>
          <th>Combo</th>
          <th>Target</th>
          <th>Total</th>
          <th>% HP</th>
          <th>Kill</th>
          <th>Overkill</th>
          <th>Duration</th>
          <th>DPS</th>
          <th>Physical</th>
          <th>Magic</th>
          <th>True</th>
        </tr>
      </thead>
      <tbody>
        {rows.map((row) => (
          <tr key={`${row.comboId}-${row.targetId}`}>
            <td>{row.comboName}</td>
            <td>{row.targetName}</td>
            <td className="num">{Math.round(row.total).toLocaleString()}</td>
            <td className="num">{row.percentHp.toFixed(1)}%</td>
            <td>{row.killed ? `Yes — ${row.killStepLabel ?? "?"}` : "No"}</td>
            <td className="num">{Math.round(row.overkill).toLocaleString()}</td>
            <td className="num">{row.durationSeconds.toFixed(2)}s</td>
            <td className="num">{Math.round(row.dps).toLocaleString()}</td>
            <td>
              <DamageTypeChip type="physical">
                {Math.round(row.physical).toLocaleString()}
              </DamageTypeChip>
            </td>
            <td>
              <DamageTypeChip type="magic">{Math.round(row.magic).toLocaleString()}</DamageTypeChip>
            </td>
            <td>
              <DamageTypeChip type="true">{Math.round(row.true).toLocaleString()}</DamageTypeChip>
            </td>
          </tr>
        ))}
      </tbody>
    </table>
  )
}
