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
}: {
  readonly championNodeId: string
  readonly itemSet: ItemSet
  readonly snapshot: Snapshot
}) {
  const renameItemSet = useGraphStore((s) => s.renameItemSet)
  const duplicateItemSet = useGraphStore((s) => s.duplicateItemSet)
  const removeItemSet = useGraphStore((s) => s.removeItemSet)
  const setItemSlot = useGraphStore((s) => s.setItemSlot)

  const resolvedItems = resolveItemSlots(itemSet.items, snapshot.items)
  const byId = new Map(snapshot.items.map((item) => [item.id, item]))

  return (
    <div className={styles.itemSetRow}>
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
        className={styles.itemSetHandle}
      />
    </div>
  )
}
