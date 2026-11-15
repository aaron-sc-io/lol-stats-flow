import { useSortable } from "@dnd-kit/sortable"
import { Handle, Position } from "@xyflow/react"
import type { CSSProperties } from "react"
import { EditableText } from "@/components/EditableText"
import { IconButton } from "@/components/IconButton"
import { Icon } from "@/components/icons"
import type { Snapshot } from "@/data/schema"
import { itemSetHandleId } from "@/graph/handle-ids"
import { resolveItemSlots } from "@/graph/item-rules"
import { useGraphStore } from "@/graph/store"
import type { ItemSet } from "@/graph/types"
import { cx } from "@/lib/cx"
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
  const {
    attributes,
    listeners,
    setNodeRef,
    transform,
    transition,
    isDragging,
    isOver,
    activeIndex,
    index,
  } = useSortable({ id: itemSet.id })
  // While another row is dragged over this one, mark which edge of it the
  // dragged row will land on.
  const dropSide = isOver && !isDragging ? (activeIndex < index ? "after" : "before") : undefined

  const resolvedItems = resolveItemSlots(itemSet.items, snapshot.items)
  const byId = new Map(snapshot.items.map((item) => [item.id, item]))

  const style: CSSProperties = {
    transform:
      transform === null ? undefined : `translate3d(${transform.x}px, ${transform.y}px, 0)`,
    transition: transition ?? undefined,
    opacity: isDragging ? 0.5 : undefined,
  }

  return (
    <div
      ref={setNodeRef}
      style={style}
      className={cx(styles.itemSetRow, isDragging && styles.itemSetRowDragging)}
      data-highlighted={highlighted ? "true" : undefined}
      data-drop-side={dropSide}
      onPointerEnter={() => {
        setHoveredItemSet(itemSet.id)
        setHoveredItemSets([itemSet.id])
      }}
      onPointerLeave={() => {
        setHoveredItemSet(null)
        setHoveredItemSets([])
      }}
    >
      <button
        type="button"
        className={styles.dragHandle}
        aria-label={`Reorder ${itemSet.name}`}
        {...attributes}
        {...listeners}
      >
        <Icon name="grip" size={16} />
      </button>
      <EditableText
        wrapperClassName={styles.itemSetName}
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
        // Reaches across NodeFrame's `--space-3` body padding + 1px border so
        // the handle dot's center lands right on the node's border edge.
        style={{
          right: "calc(-1 * var(--space-3) - var(--border-width-hairline))",
          transform: "translate(50%, -50%)",
        }}
      />
    </div>
  )
}
