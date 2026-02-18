/**
 * Deterministic pixel avatar generator.
 * Creates a 5x5 symmetric grid from a string (pseudonym or user ID).
 * No external dependencies — pure SVG.
 */

interface PixelAvatarProps {
  seed: string;
  size?: number;
  className?: string;
}

// Simple hash function — deterministic number from string
function hashCode(str: string): number {
  let hash = 0;
  for (let i = 0; i < str.length; i++) {
    const char = str.charCodeAt(i);
    hash = ((hash << 5) - hash) + char;
    hash = hash & hash; // Convert to 32-bit int
  }
  return Math.abs(hash);
}

// Generate a color from hash — picks from a curated terminal palette
const PALETTE = [
  '#3fb950', // green (accent)
  '#58a6ff', // blue
  '#d2a8ff', // purple
  '#f0883e', // orange
  '#f778ba', // pink
  '#79c0ff', // light blue
  '#7ee787', // light green
  '#ffa657', // amber
];

function getColor(hash: number): string {
  return PALETTE[hash % PALETTE.length];
}

// Generate the 5x5 grid (only need left half + center, mirror for symmetry)
function generateGrid(seed: string): boolean[][] {
  const hash = hashCode(seed);
  const grid: boolean[][] = [];

  for (let row = 0; row < 5; row++) {
    grid[row] = [];
    for (let col = 0; col < 3; col++) {
      // Use different bits of the hash for each cell
      const bit = (hash >> (row * 3 + col)) & 1;
      // Also mix in a secondary hash for more variety
      const bit2 = (hashCode(seed + row) >> col) & 1;
      grid[row][col] = (bit === 1) || (bit2 === 1 && row !== 0 && row !== 4);
    }
    // Mirror: col 3 = col 1, col 4 = col 0
    grid[row][3] = grid[row][1];
    grid[row][4] = grid[row][0];
  }

  return grid;
}

export function PixelAvatar({ seed, size = 20, className }: PixelAvatarProps) {
  const grid = generateGrid(seed);
  const color = getColor(hashCode(seed));
  const cellSize = size / 5;

  return (
    <svg
      width={size}
      height={size}
      viewBox={`0 0 ${size} ${size}`}
      className={className}
      style={{ imageRendering: 'pixelated', flexShrink: 0 }}
    >
      <rect width={size} height={size} fill="var(--bg-surface)" rx={2} />
      {grid.map((row, y) =>
        row.map((filled, x) =>
          filled ? (
            <rect
              key={`${x}-${y}`}
              x={x * cellSize}
              y={y * cellSize}
              width={cellSize}
              height={cellSize}
              fill={color}
            />
          ) : null
        )
      )}
    </svg>
  );
}
