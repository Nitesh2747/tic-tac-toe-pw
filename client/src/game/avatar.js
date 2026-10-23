// Draws an avatar from a seed: a 5x5 pattern, mirrored left to right (like a
// GitHub identicon), in a colour picked from the seed. Same seed, same avatar,
// every time and on every device, so nothing has to be stored or uploaded.

// xmur3: turns a string into a stream of well-mixed 32-bit numbers.
function hashString(text) {
  let h = 1779033703 ^ text.length;
  for (let i = 0; i < text.length; i++) {
    h = Math.imul(h ^ text.charCodeAt(i), 3432918353);
    h = (h << 13) | (h >>> 19);
  }
  return () => {
    h = Math.imul(h ^ (h >>> 16), 2246822507);
    h = Math.imul(h ^ (h >>> 13), 3266489909);
    return (h ^= h >>> 16) >>> 0;
  };
}

// mulberry32: a small seeded random number generator (0 up to, not including, 1).
function randomFrom(seed) {
  let a = seed;
  return () => {
    a = (a + 0x6d2b79f5) | 0;
    let t = Math.imul(a ^ (a >>> 15), 1 | a);
    t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t;
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

const SIZE = 5;
const MIN_FILLED = 8; // never hand out a nearly blank avatar

// Returns { cells, hue }: cells[row][col] is true where the pattern is filled.
export function getAvatar(seed) {
  const random = randomFrom(hashString(String(seed))());
  const hue = Math.floor(random() * 360);

  const cells = Array.from({ length: SIZE }, () => Array(SIZE).fill(false));
  const half = Math.ceil(SIZE / 2); // columns 0..2 are drawn, 3..4 mirror 1..0
  for (let row = 0; row < SIZE; row++) {
    for (let col = 0; col < half; col++) {
      const filled = random() > 0.5;
      cells[row][col] = filled;
      cells[row][SIZE - 1 - col] = filled;
    }
  }

  // Too sparse? Fill in more cells (still mirrored), still decided by the seed.
  let count = cells.flat().filter(Boolean).length;
  while (count < MIN_FILLED) {
    const row = Math.floor(random() * SIZE);
    const col = Math.floor(random() * half);
    if (!cells[row][col]) {
      cells[row][col] = true;
      cells[row][SIZE - 1 - col] = true;
      count = cells.flat().filter(Boolean).length;
    }
  }

  // A completely solid square is a valid pattern, but it is not much of an avatar.
  // Punch out the centre cell: it sits on the mirror line, so the pattern stays symmetric.
  if (count === SIZE * SIZE) cells[2][2] = false;

  return { cells, hue };
}
