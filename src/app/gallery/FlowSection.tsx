import {
  Background,
  BackgroundVariant,
  Controls,
  type Edge,
  Handle,
  type Node,
  type NodeProps,
  type NodeTypes,
  Position,
  ReactFlow,
  ReactFlowProvider,
  useEdgesState,
  useNodesState,
  useReactFlow,
} from "@xyflow/react"
import { FlowEdge, type FlowEdgeData } from "@/components/FlowEdge"
import { NodeFrame } from "@/components/NodeFrame"
import styles from "./GalleryLayout.module.css"

type DemoNodeData = { readonly title: string; readonly side: "source" | "target" }
type DemoNode = Node<DemoNodeData, "demo">
type DemoEdge = Edge<FlowEdgeData, "flow">

const HANDLE_IDS = ["h0", "h1", "h2"] as const

function DemoFlowNode({ id, data, selected }: NodeProps<DemoNode>) {
  const { deleteElements, addNodes, getNode } = useReactFlow<DemoNode, DemoEdge>()
  const handleType = data.side === "source" ? "source" : "target"
  const position = data.side === "source" ? Position.Right : Position.Left

  return (
    <NodeFrame
      label="Demo node"
      title={data.title}
      width={180}
      selected={selected}
      onDelete={() => void deleteElements({ nodes: [{ id }] })}
      onDuplicate={() => {
        const node = getNode(id)
        if (node !== undefined) {
          addNodes({
            ...node,
            id: `-copy-${crypto.randomUUID()}`,
            position: { x: node.position.x + 40, y: node.position.y + 40 },
            selected: false,
          })
        }
      }}
    >
      <div className={styles.nodeBody}>Sample content</div>
      {HANDLE_IDS.map((handleId, index) => (
        <Handle
          key={handleId}
          type={handleType}
          position={position}
          id={handleId}
          style={{ top: `${30 + index * 20}%` }}
        />
      ))}
    </NodeFrame>
  )
}

const NODE_TYPES: NodeTypes = { demo: DemoFlowNode }
const EDGE_TYPES = { flow: FlowEdge }

// Framework contract (see App.tsx): React Flow's `nodes`/`edges` props are
// typed as mutable arrays, so these stay non-readonly despite never
// actually being mutated.
const NODES: DemoNode[] = [
  { id: "a", type: "demo", position: { x: 40, y: 40 }, data: { title: "Node A", side: "source" } },
  { id: "b", type: "demo", position: { x: 380, y: 40 }, data: { title: "Node B", side: "target" } },
]

const EDGES: DemoEdge[] = [
  {
    id: "e-normal",
    source: "a",
    target: "b",
    sourceHandle: "h0",
    targetHandle: "h0",
    type: "flow",
    data: {},
  },
  {
    id: "e-highlighted",
    source: "a",
    target: "b",
    sourceHandle: "h1",
    targetHandle: "h1",
    type: "flow",
    data: { highlighted: true },
  },
  {
    id: "e-dimmed",
    source: "a",
    target: "b",
    sourceHandle: "h2",
    targetHandle: "h2",
    type: "flow",
    data: { dimmed: true },
  },
]

function DemoFlowCanvas() {
  const [nodes, , onNodesChange] = useNodesState(NODES)
  const [edges, , onEdgesChange] = useEdgesState(EDGES)

  return (
    <ReactFlow
      nodes={nodes}
      edges={edges}
      onNodesChange={onNodesChange}
      onEdgesChange={onEdgesChange}
      nodeTypes={NODE_TYPES}
      edgeTypes={EDGE_TYPES}
      colorMode="dark"
      fitView
      fitViewOptions={{ padding: 0.3 }}
    >
      <Background variant={BackgroundVariant.Dots} gap={24} size={2} />
      <Controls showInteractive={false} />
    </ReactFlow>
  )
}

/** Mini canvas proving the React Flow theme (dot grid, handles, Controls)
 * and `FlowEdge`'s normal/highlighted/dimmed states render correctly
 * together, without building any real domain node. */
export function FlowSection() {
  return (
    <section className={styles.section}>
      <h2 className={styles.sectionTitle}>React Flow theme</h2>
      <div className={styles.flowContainer}>
        <ReactFlowProvider>
          <DemoFlowCanvas />
        </ReactFlowProvider>
      </div>
    </section>
  )
}
