import { nanoid } from "nanoid";

// Generate a 6-char uppercase room code (e.g. "AB3K7X")
export function generateRoomCode(): string {
  const chars = "ABCDEFGHJKLMNPQRSTUVWXYZ23456789"; // no confusing 0/O/1/I
  let code = "";
  for (let i = 0; i < 6; i++) {
    code += chars[Math.floor(Math.random() * chars.length)];
  }
  return code;
}

// Direction delta maps
export const DIRECTIONS = {
  horizontal:    { dr: 0,  dc: 1  },
  vertical:      { dr: 1,  dc: 0  },
  diagonal_down: { dr: 1,  dc: 1  },
  diagonal_up:   { dr: -1, dc: 1  },
} as const;

export type Direction = keyof typeof DIRECTIONS;

// Get all cells covered by a word placement
export function getWordCells(
  startRow: number,
  startCol: number,
  direction: Direction,
  length: number
): Array<{ row: number; col: number }> {
  const { dr, dc } = DIRECTIONS[direction];
  const cells = [];
  for (let i = 0; i < length; i++) {
    cells.push({ row: startRow + dr * i, col: startCol + dc * i });
  }
  return cells;
}

// Extract word string from grid along a direction
export function extractWord(
  grid: string[][],
  startRow: number,
  startCol: number,
  direction: Direction,
  length: number
): string {
  const cells = getWordCells(startRow, startCol, direction, length);
  return cells.map(({ row, col }) => grid[row]?.[col] ?? "").join("");
}

// Determine direction from start to end cell (returns null if not a valid direction)
export function getDirection(
  startRow: number,
  startCol: number,
  endRow: number,
  endCol: number
): Direction | null {
  const dr = endRow - startRow;
  const dc = endCol - startCol;

  if (dr === 0 && dc > 0) return "horizontal";
  if (dr > 0 && dc === 0) return "vertical";
  if (dr > 0 && dc > 0 && dr === dc) return "diagonal_down";
  if (dr < 0 && dc > 0 && -dr === dc) return "diagonal_up";

  return null;
}
