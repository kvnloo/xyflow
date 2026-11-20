import { createContext, useCallback, useContext, useEffect, useRef, useState } from 'react';
import {
  Background,
  BackgroundVariant,
  Handle,
  Position,
  ReactFlow,
  ReactFlowProvider,
  addEdge,
  useEdgesState,
  useNodesState,
  type Connection,
  type ConnectionLineComponentProps,
  type Node,
  type NodeProps,
  type OnConnectEnd,
} from '@xyflow/react';

import { BundleEdge, type BundleEdgeType } from './BundleEdge';
import { FloatingConnectionLine, FloatingEdge, type FloatingEdgeType } from './FloatingEdge';
import { MagneticConnectionLine, MagneticSnap, magneticDrop, useMagneticTarget } from './MagneticConnection';
import './style.css';

const ports = ['Image', 'Control', 'Signal'] as const;
const borderRadius = 14;
type Module = Node<{ title: string; caption: string; handles: 'source' | 'target'; border?: boolean }, 'module'>;
type Cable = BundleEdgeType | FloatingEdgeType;

function ModuleNode({ data }: NodeProps<Module>) {
  const output = data.handles === 'source';
  return (
    <div className={`kv-module ${data.border ? 'kv-module-border' : ''}`}>
      <div className="kv-module-heading">
        <span className="kv-node-symbol" aria-hidden="true">
          {output ? '↗' : '◎'}
        </span>
        <div>
          <strong>{data.title}</strong>
          <small>{data.caption}</small>
        </div>
      </div>
      {data.border ? (
        <Handle
          type={data.handles}
          position={output ? Position.Right : Position.Left}
          id="border"
          aria-label={`${data.title} border`}
        />
      ) : (
        <div className="kv-ports">
          {ports.map((port, index) => (
            <div className="kv-port" key={port}>
              <span className="kv-port-index">0{index + 1}</span>
              <span>{port}</span>
              <Handle
                type={data.handles}
                position={output ? Position.Right : Position.Left}
                id={port}
                aria-label={`${data.title} ${port}`}
              />
            </div>
          ))}
        </div>
      )}
    </div>
  );
}

const nodeTypes = { module: ModuleNode };
const edgeTypes = { bundle: BundleEdge, floating: FloatingEdge };
const initialNodes: Module[] = [
  {
    id: 'deck',
    type: 'module',
    position: { x: 0, y: 0 },
    data: { title: 'Source deck', caption: 'TRANSMIT / A', handles: 'source' },
  },
  {
    id: 'mix',
    type: 'module',
    position: { x: 610, y: 0 },
    data: { title: 'Mix bus', caption: 'RECEIVE / B', handles: 'target' },
  },
  {
    id: 'scope',
    type: 'module',
    position: { x: 120, y: 263 },
    data: { title: 'Scope', caption: 'FLOAT / C', handles: 'source', border: true },
  },
  {
    id: 'monitor',
    type: 'module',
    position: { x: 515, y: 340 },
    data: { title: 'Monitor', caption: 'FLOAT / D', handles: 'target', border: true },
  },
];
const initialEdges: Cable[] = [
  ...ports.slice(0, 2).map((port): BundleEdgeType => ({
    id: port,
    source: 'deck',
    target: 'mix',
    sourceHandle: port,
    targetHandle: port,
    type: 'bundle',
  })),
  {
    id: 'scope-monitor',
    source: 'scope',
    target: 'monitor',
    sourceHandle: 'border',
    targetHandle: 'border',
    type: 'floating',
    data: { borderRadius },
    selectable: false,
    style: { stroke: '#8a8e85', strokeDasharray: '3 4' },
  },
];

function Demo() {
  const [nodes, , onNodesChange] = useNodesState(initialNodes);
  const [edges, setEdges, onEdgesChange] = useEdgesState(initialEdges);
  const [snap, setSnap] = useState<ReturnType<ReturnType<typeof useMagneticTarget>>>();
  const snapTimeout = useRef<ReturnType<typeof setTimeout> | undefined>(undefined);
  useEffect(() => () => clearTimeout(snapTimeout.current), []);

  const canConnect = useCallback(
    ({ source, target, sourceHandle, targetHandle }: Connection | Cable) =>
      source !== target &&
      sourceHandle != null &&
      sourceHandle === targetHandle &&
      !edges.some(
        (e) =>
          e.source === source &&
          e.target === target &&
          e.sourceHandle === sourceHandle &&
          e.targetHandle === targetHandle
      ),
    [edges]
  );
  const resolve = useMagneticTarget(canConnect);
  // The preview is loaded through a stable component; validation comes from the demo context below.
  const onConnect = useCallback((connection: Connection) => {
    const { sourceHandle } = connection;
    setEdges((current) =>
      addEdge(
        sourceHandle === 'border'
          ? {
              ...connection,
              id: 'scope-monitor',
              type: 'floating',
              data: { borderRadius },
              selectable: false,
              style: { strokeDasharray: '3 4' },
            }
          : { ...connection, id: sourceHandle!, type: 'bundle' },
        current
      )
    );
  }, []);
  const onConnectEnd: OnConnectEnd = (_, state) => {
    if (!state.fromHandle || state.fromHandle.id === 'border') return;
    const direct = state.isValid === true;
    const target = magneticDrop(resolve(state.fromHandle, state.pointer, direct ? state.toHandle : null), direct);
    if (!target) return;
    if (!direct) onConnect(target.connection);
    setSnap(target);
    clearTimeout(snapTimeout.current);
    snapTimeout.current = setTimeout(() => setSnap(undefined), 540);
  };
  const selected = edges.filter((edge): edge is BundleEdgeType => edge.type === 'bundle' && !!edge.selected);
  const wires = edges.filter((edge): edge is BundleEdgeType => edge.type === 'bundle');
  const tied = wires.filter((edge) => edge.data?.bundle?.tied);
  const canTie =
    !tied.length &&
    selected.length > 1 &&
    selected.every((e) => e.source === selected[0].source && e.target === selected[0].target);
  const setTied = (tie: boolean) => {
    const ids = new Set(selected.map(({ id }) => id));
    setEdges((current) =>
      current.map((edge) => {
        if (edge.type !== 'bundle') return edge;
        if (!tie)
          return edge.data?.bundle?.tied ? { ...edge, data: { bundle: { ...edge.data.bundle, tied: false } } } : edge;
        return ids.has(edge.id)
          ? { ...edge, selected: false, data: { bundle: { tied: true, leader: edge.id === selected[0].id } } }
          : edge;
      })
    );
  };

  return (
    <main className="kv-lab">
      <div className="kv-topline">
        <span>
          <b>▰</b> PATCH LAB
        </span>
        <span>XY FLOW / INTERACTION STUDY</span>
      </div>
      <div className="kv-intro">
        <div>
          <p className="kv-kicker">FIELD NOTES / 001</p>
          <h1>
            Patch <em>cables.</em>
          </h1>
        </div>
        <p className="kv-description">
          Drag Signal toward its matching input. Then select the wires and tie them into one cable.
        </p>
      </div>
      <section className="kv-stage" aria-label="Patch canvas">
        <div className="kv-stage-head">
          <span>
            <i /> LIVE PATCH
          </span>
          <span>01 / SIGNAL ROUTING</span>
        </div>
        <div className="kv-flow">
          <ValidationContext.Provider value={canConnect}>
            <ReactFlow
              nodes={nodes}
              edges={edges}
              onNodesChange={onNodesChange}
              onEdgesChange={onEdgesChange}
              {...{ nodeTypes, edgeTypes, onConnect, onConnectEnd }}
              isValidConnection={canConnect}
              connectionRadius={0}
              connectionLineComponent={PatchPreview}
              fitView
              fitViewOptions={{ padding: 0.16, maxZoom: 0.9 }}
              minZoom={0.2}
              maxZoom={2}
              multiSelectionKeyCode="Shift"
              deleteKeyCode={null}
              autoPanOnConnect={false}
            >
              <Background variant={BackgroundVariant.Dots} gap={20} size={1.2} color="#454842" />
              {snap && <MagneticSnap world={snap.world} zoom={snap.zoom} />}
            </ReactFlow>
          </ValidationContext.Provider>
        </div>
        <div className="kv-tools">
          <div className="kv-status" aria-live="polite">
            <i />
            {wires.length} wires <span>·</span> {tied.length ? `${tied.length} bundled` : `${selected.length} selected`}
          </div>
          <div className="kv-buttons">
            <button
              type="button"
              disabled={!!tied.length || wires.length < 2}
              onClick={() =>
                setEdges((current) => current.map((edge) => ({ ...edge, selected: edge.type === 'bundle' })))
              }
            >
              Select wires
            </button>
            {tied.length ? (
              <button type="button" className="kv-action" onClick={() => setTied(false)}>
                Untie
              </button>
            ) : (
              <button type="button" className="kv-action" disabled={!canTie} onClick={() => setTied(true)}>
                Tie up
              </button>
            )}
          </div>
        </div>
      </section>
      <div className="kv-footer">
        <span>SHIFT + CLICK to select individual wires</span>
        <span>Move Scope or Monitor to see the floating cable reattach</span>
      </div>
    </main>
  );
}

const ValidationContext = createContext<(connection: Connection) => boolean>(() => false);
function PatchPreview(props: ConnectionLineComponentProps) {
  const canConnect = useContext(ValidationContext);
  return props.fromHandle.id === 'border' ? (
    <FloatingConnectionLine {...props} borderRadius={borderRadius} />
  ) : (
    <MagneticConnectionLine {...props} canConnect={canConnect} />
  );
}

export default function KvnlooInteractions() {
  return (
    <ReactFlowProvider>
      <Demo />
    </ReactFlowProvider>
  );
}
