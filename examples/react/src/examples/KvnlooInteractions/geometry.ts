import { Position, type InternalNode, type XYPosition } from '@xyflow/react';

export const unit = (t: number) => Math.max(0, Math.min(1, t));
export const smooth = (t: number) => unit(t) ** 2 * (3 - 2 * unit(t));
export const mix = (a: XYPosition, b: XYPosition, t: number): XYPosition => ({
  x: a.x + (b.x - a.x) * t,
  y: a.y + (b.y - a.y) * t,
});
export const point = ({ x, y }: XYPosition) => `${x},${y}`;
export const distance = (a: XYPosition, b: XYPosition) => Math.hypot(a.x - b.x, a.y - b.y);

export function nodeBox(node: InternalNode) {
  const { x, y } = node.internals.positionAbsolute;
  const { width, height } = node.measured;
  if (!width || !height) return;
  return { x, y, width, height, center: { x: x + width / 2, y: y + height / 2 } };
}

// Project onto each straight side and quarter circle, then choose the closest projection.
export function nearestBorder(box: NonNullable<ReturnType<typeof nodeBox>>, p: XYPosition, radius: number) {
  const { x, y, width, height, center } = box;
  const r = Math.min(Math.max(0, radius), width / 2, height / 2);
  const px = Math.max(x + r, Math.min(x + width - r, p.x));
  const py = Math.max(y + r, Math.min(y + height - r, p.y));
  const sides = [
    { x: px, y, position: Position.Top },
    { x: x + width, y: py, position: Position.Right },
    { x: px, y: y + height, position: Position.Bottom },
    { x, y: py, position: Position.Left },
  ];
  const candidates = r
    ? [
        ...sides,
        ...[-1, 1].flatMap((sx) =>
          [-1, 1].map((sy) => {
            const cx = center.x + sx * (width / 2 - r);
            const cy = center.y + sy * (height / 2 - r);
            const dx = Math.max(0, (p.x - cx) * sx);
            const dy = Math.max(0, (p.y - cy) * sy);
            const angle = Math.atan2(dy, dx);
            return {
              x: cx + sx * r * Math.cos(angle),
              y: cy + sy * r * Math.sin(angle),
              position: dx >= dy ? (sx < 0 ? Position.Left : Position.Right) : sy < 0 ? Position.Top : Position.Bottom,
            };
          })
        ),
      ]
    : sides;
  return candidates.reduce((best, candidate) => (distance(candidate, p) < distance(best, p) ? candidate : best));
}
