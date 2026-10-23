// Geometry for the line drawn through the three winning tiles.
//
// The line is an SVG laid over the board. These numbers mirror the board's CSS
// (width 360px, 8px padding, 8px gap) in SVG viewBox units, so the SVG scales
// together with the board. If you change the board's sizes, change them here too.
export const BOARD_SIZE = 360;
const PADDING = 8;
const GAP = 8;
const CELL = (BOARD_SIZE - 2 * PADDING - 2 * GAP) / 3;
const OVERSHOOT = 38; // how far the line pokes out past the centre of the end tiles

// Centre of a tile, in viewBox units.
export function getTileCenter(index) {
  const row = Math.floor(index / 3);
  const col = index % 3;
  return {
    x: PADDING + col * (CELL + GAP) + CELL / 2,
    y: PADDING + row * (CELL + GAP) + CELL / 2,
  };
}

// line is [a, b, c] (board indexes, in order). Returns the two end points and
// the total length (the animation needs the length), or null if there is no line.
export function getWinLine(line) {
  if (!Array.isArray(line) || line.length !== 3) return null;

  const start = getTileCenter(line[0]);
  const end = getTileCenter(line[2]);
  const length = Math.hypot(end.x - start.x, end.y - start.y);
  const ux = (end.x - start.x) / length; // unit vector along the line
  const uy = (end.y - start.y) / length;

  return {
    x1: start.x - ux * OVERSHOOT,
    y1: start.y - uy * OVERSHOOT,
    x2: end.x + ux * OVERSHOOT,
    y2: end.y + uy * OVERSHOOT,
    length: length + 2 * OVERSHOOT,
  };
}
