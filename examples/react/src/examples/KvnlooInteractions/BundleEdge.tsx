import { useEffect, useId, useState } from 'react';
import { BaseEdge, Position, useInternalNode, type Edge, type EdgeProps, type XYPosition } from '@xyflow/react';

import { distance, mix, nodeBox, point, smooth } from './geometry';
import { useReducedMotion } from './motion';
import './effects.css';

export type BundleEdgeType = Edge<{ bundle?: { tied: boolean; leader: boolean } }, 'bundle'>;

const tieDuration = 420;
const normal = {
  [Position.Left]: { x: -1, y: 0 },
  [Position.Right]: { x: 1, y: 0 },
  [Position.Top]: { x: 0, y: -1 },
  [Position.Bottom]: { x: 0, y: 1 },
};
const offset = (a: XYPosition, b: XYPosition, length: number) => ({ x: a.x + b.x * length, y: a.y + b.y * length });
type Cubic = [XYPosition, XYPosition, XYPosition, XYPosition];

function split([a, b, c, d]: Cubic, t: number): [Cubic, Cubic] {
  const ab = mix(a, b, t);
  const bc = mix(b, c, t);
  const cd = mix(c, d, t);
  const left = mix(ab, bc, t);
  const right = mix(bc, cd, t);
  const mid = mix(left, right, t);
  return [
    [a, ab, left, mid],
    [mid, right, cd, d],
  ];
}

export function BundleEdge({
  id,
  source,
  target,
  sourceX,
  sourceY,
  sourcePosition,
  targetX,
  targetY,
  targetPosition,
  data,
  selected,
  markerStart,
  markerEnd,
  interactionWidth,
  style,
}: EdgeProps<BundleEdgeType>) {
  const sourceNode = useInternalNode(source);
  const targetNode = useInternalNode(target);
  const reduced = useReducedMotion();
  const tied = data?.bundle?.tied ?? false;
  const goal = tied ? 1 : 0;
  const [progress, setProgress] = useState(goal);
  const pathId = useId();

  useEffect(() => {
    if (reduced) return;
    let frame: number;
    let previous = performance.now();
    function tick(now: number) {
      const step = (now - previous) / tieDuration;
      previous = now;
      setProgress((p) => (tied ? Math.min(1, p + step) : Math.max(0, p - step)));
      if (now - start < tieDuration) frame = requestAnimationFrame(tick);
    }
    const start = previous;
    frame = requestAnimationFrame(tick);
    return () => cancelAnimationFrame(frame);
  }, [reduced, tied]);

  const start = { x: sourceX, y: sourceY };
  const end = { x: targetX, y: targetY };
  const tension = Math.max(18, distance(start, end) * 0.4);
  const a = offset(start, normal[sourcePosition], tension);
  const b = offset(end, normal[targetPosition], tension);
  const [lead, rest] = split([start, a, b, end], 1 / 3);
  const loose = [lead, ...split(rest, 0.5)];
  const s = (sourceNode && nodeBox(sourceNode)?.center) ?? start;
  const t = (targetNode && nodeBox(targetNode)?.center) ?? end;
  const inPoint = mix(s, t, 0.39);
  const outPoint = mix(s, t, 0.61);
  const guideIn = mix(inPoint, outPoint, 1 / 3);
  const guideOut = mix(inPoint, outPoint, 2 / 3);
  const bound: Cubic[] = [
    [start, offset(start, normal[sourcePosition], tension * 0.55), mix(inPoint, guideIn, -1), inPoint],
    [inPoint, guideIn, guideOut, outPoint],
    [outPoint, mix(outPoint, guideOut, -1), offset(end, normal[targetPosition], tension * 0.55), end],
  ];
  const p = reduced ? goal : progress;
  const eased = smooth(p);
  const path = `M${point(start)}${loose
    .map(
      (segment, i) =>
        `C${segment
          .slice(1)
          .map((v, j) => point(mix(v, bound[i][j + 1], eased)))
          .join(' ')}`
    )
    .join('')}`;
  const mid = mix(inPoint, outPoint, 0.5);
  const angle = (Math.atan2(outPoint.y - inPoint.y, outPoint.x - inPoint.x) * 180) / Math.PI;

  return (
    <g className="kv-wire" data-wire={id} data-tied={tied || undefined}>
      {selected && !tied && <path d={path} className="kv-wire-selection" />}
      <BaseEdge
        id={pathId}
        path={path}
        className="kv-wire-path"
        {...{ markerStart, markerEnd, interactionWidth, style }}
      />
      {p > 0.2 && data?.bundle?.leader && (
        <g
          data-bundle-clamp=""
          className="kv-clamp"
          opacity={smooth((p - 0.2) / 0.66)}
          transform={`translate(${mid.x} ${mid.y}) rotate(${angle})`}
        >
          <rect x="-7" y="-12" width="16" height="27" rx="4" fill="#101212" />
          <rect x="-8" y="-14" width="16" height="27" rx="4" fill="#555954" stroke="#848981" />
          <path d="M-4 -9V8M0 -9V8" stroke="#a4a89e" opacity="0.7" />
          <rect x="3" y="-5" width="8" height="9" rx="2" fill="#363a37" stroke="#777b76" />
        </g>
      )}
      {tied && p === 1 && !reduced && (
        <circle className="kv-signal" r="2.8" data-signal-bead="">
          <animateMotion
            dur="1.8s"
            begin={`${(sourceY % 1) + (Math.abs(sourceY) % 100) / 140}s`}
            repeatCount="indefinite"
          >
            <mpath href={`#${pathId}`} />
          </animateMotion>
        </circle>
      )}
    </g>
  );
}
