import {
  BaseEdge,
  getBezierPath,
  useInternalNode,
  type ConnectionLineComponentProps,
  type Edge,
  type EdgeProps,
} from '@xyflow/react';

import { nearestBorder, nodeBox } from './geometry';

export type FloatingEdgeType = Edge<{ borderRadius?: number }, 'floating'>;

export function FloatingEdge({
  id,
  source,
  target,
  data,
  markerStart,
  markerEnd,
  style,
  interactionWidth,
  label,
  labelStyle,
}: EdgeProps<FloatingEdgeType>) {
  const sourceNode = useInternalNode(source);
  const targetNode = useInternalNode(target);
  const a = sourceNode && nodeBox(sourceNode);
  const b = targetNode && nodeBox(targetNode);
  if (!a || !b) return null;

  const start = nearestBorder(a, b.center, data?.borderRadius ?? 0);
  const end = nearestBorder(b, a.center, data?.borderRadius ?? 0);
  const [path, labelX, labelY] = getBezierPath({
    sourceX: start.x,
    sourceY: start.y,
    sourcePosition: start.position,
    targetX: end.x,
    targetY: end.y,
    targetPosition: end.position,
  });
  return (
    <BaseEdge {...{ id, path, markerStart, markerEnd, style, interactionWidth, label, labelStyle, labelX, labelY }} />
  );
}

export function FloatingConnectionLine({
  fromNode,
  toNode,
  toX,
  toY,
  toPosition,
  connectionLineStyle,
  borderRadius = 0,
}: ConnectionLineComponentProps & { borderRadius?: number }) {
  const box = nodeBox(fromNode);
  const target = toNode && nodeBox(toNode);
  if (!box) return null;

  const start = nearestBorder(box, target?.center ?? { x: toX, y: toY }, borderRadius);
  const end = target && nearestBorder(target, box.center, borderRadius);
  const [path] = getBezierPath({
    sourceX: start.x,
    sourceY: start.y,
    sourcePosition: start.position,
    targetX: end?.x ?? toX,
    targetY: end?.y ?? toY,
    targetPosition: end?.position ?? toPosition,
  });
  return <path d={path} fill="none" className="react-flow__connection-path" style={connectionLineStyle} />;
}
