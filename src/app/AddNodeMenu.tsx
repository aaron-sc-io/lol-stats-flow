import { useReactFlow } from "@xyflow/react"
import { useEffect, useRef, useState } from "react"
import { IconButton } from "@/components/IconButton"
import { useGraphStore } from "@/graph/store"
import styles from "./AddNodeMenu.module.css"

const MENU_ITEMS = [
  { type: "champion", label: "Champion" },
  { type: "combo", label: "Combo" },
  { type: "graph", label: "Graph" },
] as const

/** Conservative width estimate per node type, wide enough to clear real
 * rendered content (a NodeFrame's own `width` prop plus margin) — used
 * only to place a freshly added node past the current rightmost edge,
 * never to size anything. */
const ESTIMATED_WIDTH: Record<(typeof MENU_ITEMS)[number]["type"], number> = {
  champion: 650,
  combo: 500,
  graph: 750,
}
const HORIZONTAL_GAP = 120
const DEFAULT_Y = 100

/** Top-bar "Add node" menu (plan §6 App shell, deliverable 6): a small
 * popover offering the three node types. New nodes are placed just past
 * the current rightmost node, at the same default Y as the initial
 * canvas — this keeps the overall layout's bounding box growing in width
 * only (not height), so repeated adds don't force an ever-more-extreme
 * `fitView` zoom-out. Real auto-layout is a Phase 4b nicety, not a
 * functional requirement. */
export function AddNodeMenu() {
  const [isOpen, setIsOpen] = useState(false)
  const containerRef = useRef<HTMLDivElement>(null)
  const addChampionNode = useGraphStore((s) => s.addChampionNode)
  const addComboNode = useGraphStore((s) => s.addComboNode)
  const addGraphNode = useGraphStore((s) => s.addGraphNode)
  const { fitView } = useReactFlow()

  useEffect(() => {
    if (!isOpen) {
      return
    }
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

  function handleAdd(type: (typeof MENU_ITEMS)[number]["type"]) {
    const position = nextPosition()
    if (type === "champion") {
      addChampionNode(position)
    } else if (type === "combo") {
      addComboNode(position)
    } else {
      addGraphNode(position)
    }
    setIsOpen(false)
    // Let the new node mount before re-fitting, so its measured size (not
    // a 0×0 placeholder) is what the viewport fits to.
    requestAnimationFrame(() => fitView({ duration: 200 }))
  }

  return (
    <div ref={containerRef} className={styles.root}>
      <IconButton icon="plus" aria-label="Add node" onClick={() => setIsOpen((open) => !open)} />
      {isOpen ? (
        <div role="menu" aria-label="Add node" className={styles.menu}>
          {MENU_ITEMS.map((item) => (
            <button
              key={item.type}
              type="button"
              role="menuitem"
              className={styles.menuItem}
              onClick={() => handleAdd(item.type)}
            >
              {item.label}
            </button>
          ))}
        </div>
      ) : null}
    </div>
  )
}
