import { describe, it, expect } from "vitest";
import { validateWordSubmission } from "@/server/game/validator";
import { generateGrid } from "@/server/game/generator";
import { extractWord } from "@/server/game/utils";

const TEST_GRID: string[][] = [
  ["К", "О", "Т", "А", "Х"],
  ["Ж", "Е", "Л", "Т", "Ы"],
  ["И", "Н", "А", "Р", "А"],
  ["В", "А", "Х", "А", "С"],
  ["А", "Р", "Т", "Р", "А"],
];

const TEST_WORDS = [
  { word: "КОТ",  startRow: 0, startCol: 0, direction: "horizontal" as const, length: 3 },
  { word: "ЖИВА", startRow: 1, startCol: 0, direction: "vertical" as const, length: 4 },
];

describe("validateWordSubmission", () => {
  it("accepts a valid horizontal word", () => {
    const result = validateWordSubmission({
      grid: TEST_GRID, wordList: TEST_WORDS, foundWords: [],
      startRow: 0, startCol: 0, endRow: 0, endCol: 2,
    });
    expect(result.valid).toBe(true);
    expect(result.placement?.word).toBe("КОТ");
  });

  it("rejects a word already found", () => {
    const result = validateWordSubmission({
      grid: TEST_GRID, wordList: TEST_WORDS,
      foundWords: [{ word: "КОТ", startRow: 0, startCol: 0, direction: "horizontal" }],
      startRow: 0, startCol: 0, endRow: 0, endCol: 2,
    });
    expect(result.valid).toBe(false);
    expect(result.error).toMatch(/уже найдено/);
  });

  it("rejects a word not in the word list", () => {
    const result = validateWordSubmission({
      grid: TEST_GRID, wordList: TEST_WORDS, foundWords: [],
      startRow: 0, startCol: 1, endRow: 0, endCol: 3,
    });
    expect(result.valid).toBe(false);
    expect(result.error).toMatch(/словаре/);
  });

  it("rejects selection too short (< 3 letters)", () => {
    const result = validateWordSubmission({
      grid: TEST_GRID, wordList: TEST_WORDS, foundWords: [],
      startRow: 0, startCol: 0, endRow: 0, endCol: 1,
    });
    expect(result.valid).toBe(false);
    expect(result.error).toMatch(/3 букв/);
  });

  it("rejects diagonal selection that is not diagonal", () => {
    const result = validateWordSubmission({
      grid: TEST_GRID, wordList: TEST_WORDS, foundWords: [],
      startRow: 0, startCol: 0, endRow: 2, endCol: 1,
    });
    expect(result.valid).toBe(false);
    expect(result.error).toMatch(/направление/);
  });

  it("accepts a valid vertical word", () => {
    const result = validateWordSubmission({
      grid: TEST_GRID, wordList: TEST_WORDS, foundWords: [],
      startRow: 1, startCol: 0, endRow: 4, endCol: 0,
    });
    expect(result.valid).toBe(true);
    expect(result.placement?.word).toBe("ЖИВА");
  });
});

describe("generateGrid", () => {
  it("generates a 10x10 grid", () => {
    const { grid } = generateGrid(10);
    expect(grid).toHaveLength(10);
    grid.forEach((row) => {
      expect(row).toHaveLength(10);
      row.forEach((cell) => expect(cell).toMatch(/^[А-ЯЁ]$/));
    });
  });

  it("generates placements within grid bounds", () => {
    const { placements } = generateGrid(10);
    expect(placements.length).toBeGreaterThan(0);
    placements.forEach((p) => {
      expect(p.startRow).toBeGreaterThanOrEqual(0);
      expect(p.startCol).toBeGreaterThanOrEqual(0);
      expect(p.word.length).toBeGreaterThanOrEqual(3);
    });
  });

  it("placements match actual grid letters", () => {
    const { grid, placements } = generateGrid(10);
    placements.forEach((p) => {
      const extracted = extractWord(grid, p.startRow, p.startCol, p.direction as any, p.length);
      expect(extracted).toBe(p.word);
    });
  });
});