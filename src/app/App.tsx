import type { Connection } from "@xyflow/react"
import {
  Background,
  BackgroundVariant,
  Controls,
  ReactFlow,
  ReactFlowProvider,
  useNodesInitialized,
  useReactFlow,
} from "@xyflow/react"
import "@xyflow/react/dist/style.css"
import "@/styles/reactflow-theme.css"
import { lazy, Suspense, useCallback, useEffect, useRef, useState } from "react"
import { FlowEdge } from "@/components/FlowEdge"
import { ToastProvider } from "@/components/Toast"
import { SnapshotProvider } from "@/data/snapshot-context"
import { isValidGraphConnection } from "@/graph/connection-rules"
import { useGraphStore } from "@/graph/store"
import type { FlowEdge as GraphEdge } from "@/graph/types"
import { ChampionNode } from "@/nodes/ChampionNode"
import { ComboNode } from "@/nodes/ComboNode"
import { GraphNode } from "@/nodes/GraphNode"
import {
  type EffectiveSnapshotStatus,
  startAutosave,
  useBootstrapPersistence,
  useEffectiveSnapshot,
  usePersistenceStore,
} from "@/persistence"
import styles from "./App.module.css"
import { Drawer } from "./Drawer"
import { PatchPinBanner } from "./PatchPinBanner"
import { TopBar } from "./TopBar"
import { useStableToast } from "./use-stable-toast"

const NODE_TYPES = { champion: ChampionNode, combo: ComboNode, graph: GraphNode }
const EDGE_TYPES = { flow: FlowEdge }

// `?view=gallery` lazy-loads the component gallery instead of the canvas —
// code-split so it never ships in the main bundle chunk (verified in the
// production build's asset manifest, not just by eye).
const Gallery = lazy(() => import("./Gallery"))
const isGalleryView = new URLSearchParams(window.location.search).get("view") === "gallery"

export function App() {
  return (
    <ToastProvider>
      <ReactFlowProvider>
        <AppShell />
      </ReactFlowProvider>
    </ToastProvider>
  )
}

/**
 * Everything that needs `useToast()` (bootstrap's invalid-share-link
 * notice, autosave's save-error notice, the drawer, the patch-pin
 * banner) lives below `<ToastProvider>` — `App` itself stays a thin
 * provider shell so those hooks have somewhere to read from.
 */
function AppShell() {
  const toast = useStableToast()
  useBootstrapPersistence(toast)
  useEffect(() => startAutosave(toast), [toast])

  const [isDrawerOpen, setIsDrawerOpen] = useState(false)
  const patchPin = usePersistenceStore((state) => state.patchPin)
  const pinnedPatch = patchPin.kind === "pinned-available" ? patchPin.pinnedPatch : null
  const snapshotStatus = useEffectiveSnapshot(pinnedPatch)
  const patchLabel = snapshotStatus.status === "ready" ? snapshotStatus.snapshot.meta.patch : "—"

  return (
    <div className={styles.shell}>
      <TopBar
        patchLabel={patchLabel}
        showAddNodeMenu={!isGalleryView && snapshotStatus.status === "ready"}
        isGalleryView={isGalleryView}
        onOpenDrawer={() => setIsDrawerOpen(true)}
      />
      {isGalleryView ? null : <PatchPinBanner toast={toast} />}
      {isGalleryView ? (
        <Suspense fallback={<div className={styles.loading}>Loading gallery…</div>}>
          <Gallery />
        </Suspense>
      ) : (
        <Canvas snapshotStatus={snapshotStatus} />
      )}
      {isGalleryView ? null : (
        <Drawer
          isOpen={isDrawerOpen}
          onClose={() => setIsDrawerOpen(false)}
          effectivePatch={patchLabel}
        />
      )}
    </div>
  )
}

function Canvas({ snapshotStatus }: { readonly snapshotStatus: EffectiveSnapshotStatus }) {
  if (snapshotStatus.status === "loading") {
    return (
      <div className={styles.canvas}>
        <div className={styles.loading}>Loading snapshot…</div>
      </div>
    )
  }
  if (snapshotStatus.status === "error") {
    return (
      <div className={styles.canvas}>
        <div className={styles.error} role="alert">
          Failed to load champion data: {snapshotStatus.error.message}
        </div>
      </div>
    )
  }

  return (
    <SnapshotProvider snapshot={snapshotStatus.snapshot}>
      <div className={styles.canvas}>
        <FlowCanvas />
      </div>
    </SnapshotProvider>
  )
}

function FlowCanvas() {
  const nodes = useGraphStore((s) => s.nodes)
  const edges = useGraphStore((s) => s.edges)
  const onNodesChange = useGraphStore((s) => s.onNodesChange)
  const onEdgesChange = useGraphStore((s) => s.onEdgesChange)
  const onConnect = useGraphStore((s) => s.onConnect)
  const { fitView } = useReactFlow()
  const nodesInitialized = useNodesInitialized()
  const hasFitInitialView = useRef(false)

  const isValidConnection = useCallback((connection: Connection | GraphEdge) => {
    const state = useGraphStore.getState()
    return isValidGraphConnection(connection, state.nodes, state.edges)
  }, [])

  // The static `fitView` prop fires on mount, before custom nodes (which size
  // themselves from dynamic content: item sets, ability palettes, charts)
  // have been measured by React Flow — it ends up fitting to stale/zero
  // dimensions and leaves the viewport zoomed into just the first node.
  // `useNodesInitialized` flips true only once every node has a real
  // measured width/height, so fitting then gives the correct framing. Guard
  // with a ref so this only runs once, not on every later node add/remove.
  useEffect(() => {
    if (nodesInitialized && !hasFitInitialView.current) {
      hasFitInitialView.current = true
      fitView()
    }
  }, [nodesInitialized, fitView])

  return (
    <ReactFlow
      nodes={nodes}
      edges={edges}
      nodeTypes={NODE_TYPES}
      edgeTypes={EDGE_TYPES}
      onNodesChange={onNodesChange}
      onEdgesChange={onEdgesChange}
      onConnect={onConnect}
      isValidConnection={isValidConnection}
      defaultEdgeOptions={{ type: "flow" }}
      colorMode="dark"
    >
      <Background variant={BackgroundVariant.Dots} gap={24} size={2} />
      <Controls showInteractive={false} />
    </ReactFlow>
  )
}
