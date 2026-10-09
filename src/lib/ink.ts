// Handwriting ("ink") on PDF pages and sticky notes. Points are stored as
// fractions of the drawing area (0–1 across, 0–1 down) so ink stays in place
// at any zoom or screen size; the width is a fraction of the area's width.
export type Stroke = {
  c: string; // colour
  w: number; // width, as a fraction of the area's width
  hl?: boolean; // highlighter: wide, see-through, drawn under the pen
  p: number[]; // x0, y0, x1, y1, …
};

export const round = (n: number) => Math.round(n * 10000) / 10000;

// A smooth SVG path through the points (midpoint quadratic curves), in pixels.
export function strokePath(p: number[], w: number, h: number) {
  if (p.length < 2) return "";
  const X = (i: number) => p[i] * w;
  const Y = (i: number) => p[i + 1] * h;
  if (p.length <= 4) {
    // A dot (or a two-point dash): a tiny line so the round cap shows.
    const x2 = p.length === 4 ? X(2) : X(0) + 0.01;
    const y2 = p.length === 4 ? Y(2) : Y(0);
    return `M${X(0)},${Y(0)}L${x2},${y2}`;
  }
  let d = `M${X(0)},${Y(0)}`;
  for (let i = 2; i < p.length - 2; i += 2) {
    const mx = (X(i) + X(i + 2)) / 2;
    const my = (Y(i) + Y(i + 2)) / 2;
    d += `Q${X(i)},${Y(i)} ${mx},${my}`;
  }
  return `${d}L${X(p.length - 2)},${Y(p.length - 2)}`;
}

// Does the eraser at (x, y), radius r (all in pixels), touch this stroke?
export function hits(s: Stroke, x: number, y: number, r: number, w: number, h: number) {
  const reach = r + (s.w * w) / 2;
  for (let i = 0; i < s.p.length; i += 2) {
    const ax = s.p[i] * w;
    const ay = s.p[i + 1] * h;
    if (i + 2 >= s.p.length) return Math.hypot(x - ax, y - ay) <= reach;
    const bx = s.p[i + 2] * w;
    const by = s.p[i + 3] * h;
    // Distance from the point to the segment a–b.
    const dx = bx - ax;
    const dy = by - ay;
    const t = dx || dy ? Math.max(0, Math.min(1, ((x - ax) * dx + (y - ay) * dy) / (dx * dx + dy * dy))) : 0;
    if (Math.hypot(x - (ax + t * dx), y - (ay + t * dy)) <= reach) return true;
  }
  return false;
}
