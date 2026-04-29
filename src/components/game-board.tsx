"use client";

import { useState, useCallback, useRef, useEffect } from "react";
import type { WordFoundPayload } from "@/server/ws/types";
import { getDirection } from "@/server/game/utils";

type Props = {
  grid: string[][];
  foundWords: WordFoundPayload[];
  myColor: string;
  onSubmit: (startRow: number, startCol: number, endRow: number, endCol: number) => void;
  disabled?: boolean;
};

type Cell = { row: number; col: number };
type FlashCell = { row: number; col: number; color: string; intensity: number };

export function GameBoard({ grid, foundWords, myColor, onSubmit, disabled }: Props) {
  const [selecting, setSelecting] = useState(false);
  const [startCell, setStartCell] = useState<Cell | null>(null);
  const [endCell, setEndCell] = useState<Cell | null>(null);
  const [flashCells, setFlashCells] = useState<FlashCell[]>([]);
  const prevFoundWords = useRef<Set<string>>(new Set());

  // Следим за новыми найденными словами и запускаем эффект
  useEffect(() => {
    for (const fw of foundWords) {
      const key = `${fw.word}-${fw.startRow}-${fw.startCol}`;
      if (!prevFoundWords.current.has(key)) {
        prevFoundWords.current.add(key);
        triggerFlash(fw);
      }
    }
  }, [foundWords]);

  function triggerFlash(fw: WordFoundPayload) {
    const cells = getWordCellsFromPayload(fw);
    const newFlash: FlashCell[] = cells.map((c) => ({
      ...c, color: fw.color, intensity: 1,
    }));

    setFlashCells((prev) => [...prev, ...newFlash]);

    // Анимация затухания
    let start: number | null = null;
    const duration = 1200;

    function animate(ts: number) {
      if (!start) start = ts;
      const progress = Math.min((ts - start) / duration, 1);
      const intensity = 1 - progress;

      setFlashCells((prev) =>
        prev
          .map((c) => {
            const isFlashing = newFlash.some((n) => n.row === c.row && n.col === c.col && n.color === c.color);
            return isFlashing ? { ...c, intensity } : c;
          })
          .filter((c) => c.intensity > 0)
      );

      if (progress < 1) requestAnimationFrame(animate);
    }

    requestAnimationFrame(animate);
  }

  function getCellFoundColor(row: number, col: number): string | null {
    for (const fw of foundWords) {
      const cells = getWordCellsFromPayload(fw);
      if (cells.some((c) => c.row === row && c.col === col)) {
        return fw.color;
      }
    }
    return null;
  }

  function getFlashIntensity(row: number, col: number): { color: string; intensity: number } | null {
    const cell = flashCells.find((c) => c.row === row && c.col === col);
    return cell ?? null;
  }

  function isSelected(row: number, col: number): boolean {
    if (!startCell || !endCell) return false;
    return getSelectionCells(startCell, endCell).some((c) => c.row === row && c.col === col);
  }

  function handleMouseDown(row: number, col: number) {
    if (disabled) return;
    setSelecting(true);
    setStartCell({ row, col });
    setEndCell({ row, col });
  }

  function handleMouseEnter(row: number, col: number) {
    if (!selecting || disabled) return;
    setEndCell({ row, col });
  }

  function handleMouseUp() {
    if (!selecting || !startCell || !endCell) return;
    setSelecting(false);
    const dir = getDirection(startCell.row, startCell.col, endCell.row, endCell.col);
    if (dir) onSubmit(startCell.row, startCell.col, endCell.row, endCell.col);
    setStartCell(null);
    setEndCell(null);
  }

  const size = grid.length;

  return (
    <div
      className="select-none touch-none"
      onMouseUp={handleMouseUp}
      onMouseLeave={() => { if (selecting) handleMouseUp(); }}
    >
      <div className="grid gap-0.5" style={{ gridTemplateColumns: `repeat(${size}, 1fr)` }}>
        {grid.map((row, rIdx) =>
          row.map((letter, cIdx) => {
            const foundColor = getCellFoundColor(rIdx, cIdx);
            const selected = isSelected(rIdx, cIdx);
            const flash = getFlashIntensity(rIdx, cIdx);
            const isStart = startCell?.row === rIdx && startCell?.col === cIdx;

            // Flash effect: пульсирующий белый/цветной фон
            const flashBg = flash
              ? `rgba(255,255,255,${flash.intensity * 0.85})`
              : null;
            const flashShadow = flash
              ? `0 0 ${Math.round(flash.intensity * 18)}px ${flash.color}, 0 0 ${Math.round(flash.intensity * 8)}px #fff`
              : null;

            return (
              <div
                key={`${rIdx}-${cIdx}`}
                onMouseDown={() => handleMouseDown(rIdx, cIdx)}
                onMouseEnter={() => handleMouseEnter(rIdx, cIdx)}
                className="relative flex items-center justify-center w-full aspect-square rounded text-sm font-bold cursor-pointer transition-colors duration-75 border"
                style={{
                  backgroundColor: flashBg
                    ? flashBg
                    : selected
                    ? `${myColor}99`
                    : foundColor
                    ? `${foundColor}55`
                    : "rgb(31 41 55)",
                  color: flash
                    ? flash.color
                    : foundColor
                    ? foundColor
                    : selected
                    ? "#fff"
                    : "#d1d5db",
                  borderColor: selected
                    ? "rgba(255,255,255,0.6)"
                    : flash
                    ? flash.color
                    : foundColor
                    ? `${foundColor}44`
                    : "rgba(75,85,99,0.5)",
                  boxShadow: flashShadow ?? (isStart ? `0 0 0 2px ${myColor}` : undefined),
                  transform: flash ? `scale(${1 + flash.intensity * 0.15})` : selected ? "scale(1.05)" : "scale(1)",
                  zIndex: flash ? 10 : selected ? 5 : 1,
                  fontWeight: flash ? "900" : "700",
                }}
              >
                {letter}
              </div>
            );
          })
        )}
      </div>
    </div>
  );
}

function getSelectionCells(start: Cell, end: Cell): Cell[] {
  const dr = end.row - start.row;
  const dc = end.col - start.col;
  const dir = getDirection(start.row, start.col, end.row, end.col);
  if (!dir && (dr !== 0 || dc !== 0)) return [start];
  const length = Math.max(Math.abs(dr), Math.abs(dc)) + 1;
  const stepR = dr === 0 ? 0 : dr > 0 ? 1 : -1;
  const stepC = dc === 0 ? 0 : dc > 0 ? 1 : -1;
  return Array.from({ length }, (_, i) => ({
    row: start.row + stepR * i,
    col: start.col + stepC * i,
  }));
}

function getWordCellsFromPayload(fw: WordFoundPayload): Cell[] {
  const dirMap: Record<string, { dr: number; dc: number }> = {
    horizontal:    { dr: 0, dc: 1 },
    vertical:      { dr: 1, dc: 0 },
    diagonal_down: { dr: 1, dc: 1 },
    diagonal_up:   { dr: -1, dc: 1 },
  };
  const { dr, dc } = dirMap[fw.direction] ?? { dr: 0, dc: 1 };
  return Array.from({ length: fw.length }, (_, i) => ({
    row: fw.startRow + dr * i,
    col: fw.startCol + dc * i,
  }));
}