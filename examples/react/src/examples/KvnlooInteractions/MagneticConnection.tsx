import { useCallback } from 'react';
import {
  getBezierPath,
  useReactFlow,
  ViewportPortal,
  type Connection,
  type ConnectionLineComponentProps,
  type HandleBounds,
  type XYPosition,
} from '@xyflow/react';

import { distance, mix, point, smooth } from './geometry';
import './effects.css';

const radius = 27;
const attract = radius * 3;
const capture = radius * 1.7;
const tipRadius = radius * 0.3;

// Pass the same strict-mode policy to React Flow. Include any per-handle drop restrictions here.
export function useMagneticTarget(canConnect: (connection: Connection) => boolean) {
  const { getNodes, getInternalNode, getViewport } = useReactFlow();
  return useCallback(
    (from: HandleBounds, pointer: XYPosition, direct?: HandleBounds | null) => {
      const viewport = getViewport();
      const opposite = from.type === 'source' ? 'target' : 'source';
      const candidate = (handle: HandleBounds, world: XYPosition) => {
        if (handle.type !== opposite) return;
        const a = { node: from.nodeId, id: from.id ?? null };
        const b = { node: handle.nodeId, id: handle.id ?? null };
        const [s, t] = from.type === 'source' ? [a, b] : [b, a];
        const connection = { source: s.node, sourceHandle: s.id, target: t.node, targetHandle: t.id };
        if (!canConnect(connection)) return;
        const center = { x: world.x * viewport.zoom + viewport.x, y: world.y * viewport.zoom + viewport.y };
        return {
          center,
          world,
          connection,
          position: handle.position,
          zoom: viewport.zoom,
          distance: distance(center, pointer),
        };
      };
      if (direct) return candidate(direct, direct);
      let nearest: ReturnType<typeof candidate>;
      for (const { id, hidden, connectable } of getNodes()) {
        if (hidden || connectable === false) continue;
        const node = getInternalNode(id);
        if (!node) continue;
        const { x, y } = node.internals.positionAbsolute;
        for (const handle of node.internals.handleBounds?.[opposite] ?? []) {
          const world = { x: x + handle.x + handle.width / 2, y: y + handle.y + handle.height / 2 };
          const screen = { x: world.x * viewport.zoom + viewport.x, y: world.y * viewport.zoom + viewport.y };
          if (distance(screen, pointer) >= (nearest?.distance ?? attract)) continue;
          const next = candidate(handle, world);
          if (next) nearest = next;
        }
      }
      return nearest;
    },
    [canConnect, getInternalNode, getNodes, getViewport]
  );
}

export function magneticDrop(target: ReturnType<ReturnType<typeof useMagneticTarget>>, direct: boolean) {
  return target && (direct || target.distance <= capture) ? target : undefined;
}

// Cubic tangents join two circular lobes; the circles are drawn separately underneath.
function neck(a: XYPosition, r1: number, b: XYPosition, r2: number) {
  const d = distance(a, b);
  if (d <= Math.abs(r1 - r2) || d > r1 + 3 * r2) return;
  const angle = Math.atan2(b.y - a.y, b.x - a.x);
  const polar = (p: XYPosition, theta: number, r: number) => ({
    x: p.x + r * Math.cos(theta),
    y: p.y + r * Math.sin(theta),
  });
  const acos = (x: number) => Math.acos(Math.max(-1, Math.min(1, x)));
  const u1 = d < r1 + r2 ? acos((r1 * r1 + d * d - r2 * r2) / (2 * r1 * d)) : 0;
  const u2 = d < r1 + r2 ? acos((r2 * r2 + d * d - r1 * r1) / (2 * r2 * d)) : 0;
  const spread = acos((r1 - r2) / d);
  const s = (u1 + spread) / 2;
  const t = (Math.PI - u2 + spread) / 2;
  const [a0, a1, b0, b1] = [
    polar(a, angle + s, r1),
    polar(a, angle - s, r1),
    polar(b, angle + t, r2),
    polar(b, angle - t, r2),
  ];
  const k = Math.min(1.2, distance(a0, b0) / (r1 + r2)) * Math.min(1, (2 * d) / (r1 + r2));
  const tangent = (p: XYPosition, theta: number, r: number) => point(polar(p, angle + theta, r * k));
  const q = Math.PI / 2;
  return `M${point(a0)}C${tangent(a0, s - q, r1)} ${tangent(b0, t + q, r2)} ${point(b0)}L${point(b1)}C${tangent(b1, -t - q, r2)} ${tangent(a1, -s + q, r1)} ${point(a1)}Z`;
}

export function MagneticConnectionLine({
  fromHandle,
  fromX,
  fromY,
  fromPosition,
  toPosition,
  toHandle,
  connectionStatus,
  pointer,
  connectionLineStyle,
  canConnect,
}: ConnectionLineComponentProps & { canConnect: (connection: Connection) => boolean }) {
  const resolve = useMagneticTarget(canConnect);
  const { x, y, zoom } = useReactFlow().getViewport();
  const direct = connectionStatus === 'valid';
  const target = resolve(fromHandle, pointer, direct ? toHandle : null);
  const snapped = magneticDrop(target, direct);
  const d = target?.distance ?? attract;
  const growth = snapped ? 1 : smooth((attract - d) / (attract - capture));
  const halo = radius * growth;
  const reach = d > radius ? d - (d - radius) * 0.12 : Math.min(d * 0.58, radius * 0.62);
  const tip = target
    ? mix(pointer, target.center, snapped ? 1 - reach / Math.max(d, 0.001) : 0.14 * growth ** 2)
    : pointer;
  const [path] = getBezierPath({
    sourceX: fromX * zoom + x,
    sourceY: fromY * zoom + y,
    sourcePosition: fromPosition,
    targetX: tip.x,
    targetY: tip.y,
    targetPosition: target?.position ?? toPosition,
  });
  return (
    <g
      className="kv-magnetic"
      data-magnet={snapped ? 'captured' : target ? 'attracting' : 'idle'}
      transform={`scale(${1 / zoom}) translate(${-x} ${-y})`}
    >
      {target && halo > 0.5 && (
        <g className="kv-halo" opacity={snapped ? 0.5 : 0.28}>
          <path d={neck(target.center, halo, tip, tipRadius)} />
          <circle cx={target.center.x} cy={target.center.y} r={halo} />
          <circle cx={tip.x} cy={tip.y} r={tipRadius} />
        </g>
      )}
      <path className="kv-preview" d={path} style={connectionLineStyle} />
      <circle className="kv-tip" cx={tip.x} cy={tip.y} r={snapped ? 4 : 2.5} />
    </g>
  );
}

export function MagneticSnap({ world, zoom }: { world: XYPosition; zoom: number }) {
  // The preview is pane-space, while the release effect lives in the world-space viewport.
  return (
    <ViewportPortal>
      <svg className="kv-snap" width="1" height="1" aria-hidden="true" style={{ left: world.x, top: world.y }}>
        <circle className="kv-snap-collapse" r={radius / zoom} />
        <circle className="kv-snap-ring" r={(radius * 1.18) / zoom} />
      </svg>
    </ViewportPortal>
  );
}
