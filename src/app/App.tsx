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
import { lazy, Suspense } from "react"
import { IconButton } from "@/components/IconButton"
import { ToastProvider } from "@/components/Toast"
import styles from "./App.module.css"

// React Flow's `nodes`/`edges` props are typed as mutable arrays (framework
// contract, see programming skill: "readonly does not apply to framework
// state"). Module-level constants keep the reference stable across renders.
const EMPTY_NODES: Node[] = []
const EMPTY_EDGES: Edge[] = []

// `?view=gallery` lazy-loads the component gallery instead of the canvas —
// code-split so it never ships in the main bundle chunk (verified in the
// production build's asset manifest, not just by eye).
const Gallery = lazy(() => import("./Gallery"))
const isGalleryView = new URLSearchParams(window.location.search).get("view") === "gallery"

export function App() {
  return (
    <ToastProvider>
      <div className={styles.shell}>
        <TopBar />
        {isGalleryView ? (
          <Suspense fallback={<div className={styles.loading}>Loading gallery…</div>}>
            <Gallery />
          </Suspense>
        ) : (
          <Canvas />
        )}
      </div>
    </ToastProvider>
  )
}

function Canvas() {
  return (
    <div className={styles.canvas}>
      <ReactFlowProvider>
        <ReactFlow nodes={EMPTY_NODES} edges={EMPTY_EDGES} colorMode="dark" fitView>
          {/* `size` is the dot's rendered radius × 2 (@xyflow/react halves it
              internally), so the spec's "1px dot" read as `size={1}` is a
              ~0.5px-radius circle — sub-pixel and antialiased into near
              invisibility, especially below 100% zoom. `size={2}` (1px
              radius, matching `--border-width-hairline`) is the smallest
              value that reliably renders, while keeping the dot color at
              the spec's `--gray-3` for the "quiet chrome" contrast level. */}
          <Background variant={BackgroundVariant.Dots} gap={24} size={2} />
          <Controls showInteractive={false} />
        </ReactFlow>
      </ReactFlowProvider>
    </div>
  )
}

function TopBar() {
  return (
    <header className={styles.topBar}>
      <div className={styles.topBarLeft}>
        <IconButton icon="menu" aria-label="Open menu" />
        <span className={styles.title}>lol-stats-flow</span>
      </div>
      <span className={`${styles.patch} num`}>Patch —</span>
    </header>
  )
}
