import { Handle, Position } from "@xyflow/react"
import { IconButton } from "@/components/IconButton"
import type { Snapshot } from "@/data/schema"
import { itemSetHandleId } from "@/graph/handle-ids"
import { resolveItemSlots } from "@/graph/item-rules"
import { useGraphStore } from "@/graph/store"
import type { ItemSet } from "@/graph/types"
import styles from "./ChampionNode.module.css"
import { ItemSlotControl } from "./ItemSlotControl"

export function ItemSetRow({
  championNodeId,
  itemSet,
  snapshot,
  highlighted,
}: {
  readonly championNodeId: string
  readonly itemSet: ItemSet
  readonly snapshot: Snapshot
  readonly highlighted: boolean
}) {
  const renameItemSet = useGraphStore((s) => s.renameItemSet)
  const duplicateItemSet = useGraphStore((s) => s.duplicateItemSet)
  const removeItemSet = useGraphStore((s) => s.removeItemSet)
  const setItemSlot = useGraphStore((s) => s.setItemSlot)
  const setHoveredItemSet = useGraphStore((s) => s.setHoveredItemSet)
  const setHoveredItemSets = useGraphStore((s) => s.setHoveredItemSets)

  const resolvedItems = resolveItemSlots(itemSet.items, snapshot.items)
  const byId = new Map(snapshot.items.map((item) => [item.id, item]))

  return (
    <div
      className={styles.itemSetRow}
      data-highlighted={highlighted ? "true" : undefined}
      onPointerEnter={() => {
        setHoveredItemSet(itemSet.id)
        setHoveredItemSets([itemSet.id])
      }}
      onPointerLeave={() => {
        setHoveredItemSet(null)
        setHoveredItemSets([])
      }}
    >
      <input
        type="text"
        className={styles.itemSetName}
        value={itemSet.name}
        onChange={(event) => renameItemSet(championNodeId, itemSet.id, event.target.value)}
        aria-label="Item set name"
      />
      <div className={styles.slots}>
        {itemSet.items.map((slotValue, index) => {
          const equipped = slotValue === null ? null : (byId.get(slotValue) ?? null)
          return (
            <ItemSlotControl
              // biome-ignore lint/suspicious/noArrayIndexKey: fixed-size positional slot tuple, never reordered
              key={index}
              snapshot={snapshot}
              equipped={equipped}
              currentSetItems={resolvedItems}
              onEquip={(item) => setItemSlot(championNodeId, itemSet.id, index, item.id)}
              onRemove={() => setItemSlot(championNodeId, itemSet.id, index, null)}
              slotLabel={`${itemSet.name} slot ${index + 1}`}
            />
          )
        })}
      </div>
      <div className={styles.rowActions}>
        <IconButton
          icon="copy"
          aria-label={`Duplicate ${itemSet.name}`}
          size={24}
          onClick={() => duplicateItemSet(championNodeId, itemSet.id)}
        />
        <IconButton
          icon="trash"
          aria-label={`Remove ${itemSet.name}`}
          size={24}
          onClick={() => removeItemSet(championNodeId, itemSet.id)}
        />
      </div>
      <Handle
        type="source"
        position={Position.Right}
        id={itemSetHandleId(itemSet.id)}
        // Breaches past this row's own box and NodeFrame's `--space-3` body
        // padding so the handle's outer edge lands exactly on the node's
        // true right border — flush with the edge (defect: previously sat
        // deep inside the row's reserved padding) and fully contained, no
        // overflow (plan Phase 4 AC #1: "lies fully inside the node box").
        // Set via inline style (not a CSS class) to unconditionally beat
        // the library's own `.react-flow__handle-right{right:0;
        // transform:translate(50%,-50%)}` base rule regardless of CSS
        // import order.
        style={{ right: "calc(-1 * var(--space-3))", transform: "translateY(-50%)" }}
      />
    </div>
  )
}
