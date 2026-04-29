import { getDirection, extractWord } from "./utils";
import type { WordPlacement } from "@/server/db/schema";

interface ValidateInput {
  grid: string[][];
  wordList: WordPlacement[];
  foundWords: Array<{ word: string; startRow: number; startCol: number; direction: string }>;
  startRow: number;
  startCol: number;
  endRow: number;
  endCol: number;
}

interface ValidateResult {
  valid: boolean;
  error?: string;
  placement?: WordPlacement;
}

export function validateWordSubmission(input: ValidateInput): ValidateResult {
  const { grid, wordList, foundWords, startRow, startCol, endRow, endCol } = input;

  // 1. Determine direction
  const direction = getDirection(startRow, startCol, endRow, endCol);
  if (!direction) {
    return { valid: false, error: "Недопустимое направление выделения" };
  }

  // 2. Calculate length
  const dr = Math.abs(endRow - startRow);
  const dc = Math.abs(endCol - startCol);
  const length = Math.max(dr, dc) + 1;

  if (length < 3) {
    return { valid: false, error: "Слово должно быть не менее 3 букв" };
  }

  // 3. Extract the word from the grid
  const extractedWord = extractWord(grid, startRow, startCol, direction, length);

  // 4. Find matching placement in the word list (server truth)
  const placement = wordList.find(
    (p) =>
      p.word === extractedWord &&
      p.startRow === startRow &&
      p.startCol === startCol &&
      p.direction === direction
  );

  if (!placement) {
    return { valid: false, error: "Слово не найдено в словаре" };
  }

  // 5. Check if already found
  const alreadyFound = foundWords.some(
    (fw) =>
      fw.word === placement.word &&
      fw.startRow === placement.startRow &&
      fw.startCol === placement.startCol &&
      fw.direction === placement.direction
  );

  if (alreadyFound) {
    return { valid: false, error: "Слово уже найдено другим игроком" };
  }

  return { valid: true, placement };
}
