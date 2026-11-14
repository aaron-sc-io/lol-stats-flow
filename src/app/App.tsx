import {
  Background,
  BackgroundVariant,
  Controls,
  type Edge,
  type Node,
  ReactFlow,
  ReactFlowProvider,
} from "@xyflow/react"
import "@xyflow/react/dist/style.css"
import "@/styles/reactflow-theme.css"
import styles from "./App.module.css"

// React Flow's `nodes`/`edges` props are typed as mutable arrays (framework
// contract, see programming skill: "readonly does not apply to framework
// state"). Module-level constants keep the reference stable across renders.
const EMPTY_NODES: Node[] = []
const EMPTY_EDGES: Edge[] = []

export function App() {
  return (
    <div className={styles.shell}>
      <TopBar />
      <div className={styles.canvas}>
        <ReactFlowProvider>
          <ReactFlow nodes={EMPTY_NODES} edges={EMPTY_EDGES} colorMode="dark" fitView>
            <Background variant={BackgroundVariant.Dots} gap={24} size={1} />
            <Controls showInteractive={false} />
          </ReactFlow>
        </ReactFlowProvider>
      </div>
    </div>
  )
}

function TopBar() {
  return (
    <header className={styles.topBar}>
      <div className={styles.topBarLeft}>
        <button type="button" className={styles.menuButton} aria-label="Open menu">
          <HamburgerIcon />
        </button>
        <span className={styles.title}>lol-stats-flow</span>
      </div>
      <span className={`${styles.patch} num`}>Patch —</span>
    </header>
  )
}

function HamburgerIcon() {
  return (
    <svg width="16" height="16" viewBox="0 0 16 16" fill="none" aria-hidden="true">
      <path d="M2 4H14" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" />
      <path d="M2 8H14" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" />
      <path d="M2 12H14" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" />
    </svg>
  )
}
