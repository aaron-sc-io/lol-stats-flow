import { useReactFlow } from "@xyflow/react"
import { type KeyboardEvent as ReactKeyboardEvent, useEffect, useId, useRef, useState } from "react"
import { IconButton } from "@/components/IconButton"
import { useGraphStore } from "@/graph/store"
import type { FlowNode, GraphKind } from "@/graph/types"
import styles from "./AddNodeMenu.module.css"

export type GraphMenuEntry = {
  readonly id: string
  readonly graphKind: GraphKind
  readonly label: string
}

/**
 * Append new graph kinds here to automatically populate the "Graphs:"
 * section in the Add Node menu.
 */
export const GRAPH_MENU_ITEMS: readonly GraphMenuEntry[] = [
  { id: "graph-targets", graphKind: "targets", label: "Combo Damage vs Targets" },
  { id: "graph-resists", graphKind: "resists", label: "Effective Damage" },
]

export type MenuItemSpec =
  | { readonly id: "champion"; readonly type: "champion"; readonly label: string }
  | { readonly id: "combo"; readonly type: "combo"; readonly label: string }
  | {
      readonly id: string
      readonly type: "graph"
      readonly graphKind: GraphKind
      readonly label: string
    }

export type MenuSection = {
  readonly id: string
  readonly heading?: string | undefined
  readonly items: readonly MenuItemSpec[]
}

export const MENU_SECTIONS: readonly MenuSection[] = [
  {
    id: "nodes",
    items: [
      { id: "champion", type: "champion", label: "Champion" },
      { id: "combo", type: "combo", label: "Combo" },
    ],
  },
  {
    id: "graphs",
    heading: "Graphs:",
    items: GRAPH_MENU_ITEMS.map((entry) => ({
      id: entry.id,
      type: "graph" as const,
      graphKind: entry.graphKind,
      label: entry.label,
    })),
  },
]

const FLAT_MENU_ITEMS: readonly MenuItemSpec[] = MENU_SECTIONS.flatMap((section) => section.items)

/** Conservative width estimate per node type, wide enough to clear real
 * rendered content (a NodeFrame's own `width` prop plus margin) — used
 * only to place a freshly added node past the current rightmost edge,
 * never to size anything. */
const ESTIMATED_WIDTH: Record<FlowNode["type"], number> = {
  champion: 650,
  combo: 500,
  graph: 750,
  tutorial: 460,
}
const HORIZONTAL_GAP = 120
const DEFAULT_Y = 100

/** Top-bar "Add node" menu (plan §6 App shell, deliverable 6): a grouped,
 * scrollable popover offering node and graph types. New nodes are placed
 * just past the current rightmost node, at the same default Y as the initial
 * canvas — this keeps the overall layout's bounding box growing in width
 * only (not height), so repeated adds don't force an ever-more-extreme
 * `fitView` zoom-out. */
export function AddNodeMenu() {
  const [isOpen, setIsOpen] = useState(false)
  const [activeIndex, setActiveIndex] = useState(0)
  const containerRef = useRef<HTMLDivElement>(null)
  const itemRefs = useRef<Array<HTMLButtonElement | null>>([])
  const menuId = useId()
  const addChampionNode = useGraphStore((s) => s.addChampionNode)
  const addComboNode = useGraphStore((s) => s.addComboNode)
  const addGraphNode = useGraphStore((s) => s.addGraphNode)
  const { fitView } = useReactFlow()

  useEffect(() => {
    if (!isOpen) {
      return
    }
    itemRefs.current[0]?.focus()
    function handlePointerDown(event: PointerEvent) {
      if (containerRef.current !== null && !containerRef.current.contains(event.target as Node)) {
        setIsOpen(false)
      }
    }
    function handleKeyDown(event: KeyboardEvent) {
      if (event.key === "Escape") {
        setIsOpen(false)
      }
    }
    document.addEventListener("pointerdown", handlePointerDown)
    document.addEventListener("keydown", handleKeyDown)
    return () => {
      document.removeEventListener("pointerdown", handlePointerDown)
      document.removeEventListener("keydown", handleKeyDown)
    }
  }, [isOpen])

  function focusItem(index: number) {
    setActiveIndex(index)
    const target = itemRefs.current[index]
    target?.focus()
    if (typeof target?.scrollIntoView === "function") {
      target.scrollIntoView({ block: "nearest" })
    }
  }

  function handleMenuKeyDown(event: ReactKeyboardEvent<HTMLDivElement>) {
    const count = FLAT_MENU_ITEMS.length
    if (count === 0) {
      return
    }
    if (event.key === "ArrowDown") {
      event.preventDefault()
      focusItem((activeIndex + 1) % count)
    } else if (event.key === "ArrowUp") {
      event.preventDefault()
      focusItem((activeIndex - 1 + count) % count)
    } else if (event.key === "Home") {
      event.preventDefault()
      focusItem(0)
    } else if (event.key === "End") {
      event.preventDefault()
      focusItem(count - 1)
    }
  }

  function nextPosition() {
    const { nodes } = useGraphStore.getState()
    if (nodes.length === 0) {
      return { x: 0, y: DEFAULT_Y }
    }
    const rightmostEdge = Math.max(
      ...nodes.map(
        (node) => node.position.x + (node.measured?.width ?? ESTIMATED_WIDTH[node.type]),
      ),
    )
    return { x: rightmostEdge + HORIZONTAL_GAP, y: DEFAULT_Y }
  }

  function handleAdd(item: MenuItemSpec) {
    const position = nextPosition()
    if (item.type === "champion") {
      addChampionNode(position)
    } else if (item.type === "combo") {
      addComboNode(position)
    } else {
      addGraphNode(position, item.graphKind)
    }
    setIsOpen(false)
    // Let the new node mount before re-fitting, so its measured size (not
    // a 0×0 placeholder) is what the viewport fits to.
    requestAnimationFrame(() => fitView({ duration: 200 }))
  }

  function toggleMenu() {
    setIsOpen((open) => {
      const next = !open
      if (next) {
        setActiveIndex(0)
      }
      return next
    })
  }

  let flatCursor = 0

  return (
    <div ref={containerRef} className={styles.root}>
      <IconButton icon="plus" aria-label="Add node" onClick={toggleMenu} />
      {isOpen ? (
        <div
          role="menu"
          aria-label="Add node"
          className={styles.menu}
          onKeyDown={handleMenuKeyDown}
        >
          {MENU_SECTIONS.map((section) => {
            const headingId = section.heading !== undefined ? `${menuId}-${section.id}` : undefined
            return (
              // biome-ignore lint/a11y/useSemanticElements: WAI-ARIA menu pattern uses role="group" to group menuitem children inside role="menu".
              <div
                key={section.id}
                role="group"
                aria-labelledby={headingId}
                className={styles.section}
              >
                {section.heading !== undefined ? (
                  <div id={headingId} role="presentation" className={styles.sectionHeader}>
                    {section.heading}
                  </div>
                ) : null}
                {section.items.map((item) => {
                  const index = flatCursor
                  flatCursor += 1
                  return (
                    <button
                      key={item.id}
                      ref={(el) => {
                        itemRefs.current[index] = el
                      }}
                      type="button"
                      role="menuitem"
                      tabIndex={index === activeIndex ? 0 : -1}
                      data-active={index === activeIndex ? "true" : undefined}
                      className={styles.menuItem}
                      onMouseEnter={() => setActiveIndex(index)}
                      onFocus={() => setActiveIndex(index)}
                      onClick={() => handleAdd(item)}
                    >
                      {item.label}
                    </button>
                  )
                })}
              </div>
            )
          })}
        </div>
      ) : null}
    </div>
  )
}
