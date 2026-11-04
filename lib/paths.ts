export type Point = { x: number; y: number };

export function distance(a: Point, b: Point) {
  return Math.hypot(b.x - a.x, b.y - a.y);
}

/**
 * Control point for a gently curved path from `a` to `b`: the midpoint pushed
 * sideways by `bend` (a fraction of the distance, sign picks the side).
 */
export function curveControl(a: Point, b: Point, bend: number): Point {
  const mx = (a.x + b.x) / 2;
  const my = (a.y + b.y) / 2;
  const dx = b.x - a.x;
  const dy = b.y - a.y;
  // Perpendicular of (dx, dy) is (-dy, dx); its length equals the distance.
  return { x: mx - dy * bend, y: my + dx * bend };
}

export function quadPoint(a: Point, c: Point, b: Point, t: number): Point {
  const u = 1 - t;
  return {
    x: u * u * a.x + 2 * u * t * c.x + t * t * b.x,
    y: u * u * a.y + 2 * u * t * c.y + t * t * b.y,
  };
}

/** Seconds for a hand-like move: quick for short hops, capped for long ones. */
export function travelSeconds(dist: number, speed = 1) {
  const base = 0.22 + Math.sqrt(Math.max(dist, 0)) / 38;
  return Math.min(Math.max(base, 0.25), 1.4) / Math.max(speed, 0.05);
}
