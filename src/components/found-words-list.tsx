"use client";

import type { WordFoundPayload } from "@/server/ws/types";

type Props = {
  foundWords: WordFoundPayload[];
  totalWords: number;
};

export function FoundWordsList({ foundWords, totalWords }: Props) {
  return (
    <div>
      <div className="flex items-center justify-between mb-3">
        <h3 className="text-sm font-medium text-gray-400">Найденные слова</h3>
        <span className="text-xs text-gray-500">
          {foundWords.length} / {totalWords}
        </span>
      </div>

      {/* Progress bar */}
      <div className="w-full bg-gray-800 rounded-full h-1.5 mb-3">
        <div
          className="h-1.5 rounded-full transition-all duration-500"
          style={{
            width: totalWords > 0 ? `${(foundWords.length / totalWords) * 100}%` : "0%",
            backgroundColor: "#3B82F6",
          }}
        />
      </div>

      {/* Word list */}
      <div className="space-y-1 max-h-64 overflow-y-auto">
        {foundWords.length === 0 ? (
          <p className="text-xs text-gray-600 text-center py-4">
            Слова ещё не найдены
          </p>
        ) : (
          [...foundWords]
            .sort((a, b) => new Date(b.foundAt).getTime() - new Date(a.foundAt).getTime())
            .map((fw, i) => (
              <div
                key={i}
                className="flex items-center gap-2 py-1 animate-fade-in"
              >
                <div
                  className="w-2 h-2 rounded-full flex-shrink-0"
                  style={{ backgroundColor: fw.color }}
                />
                <span
                  className="text-sm font-mono font-medium"
                  style={{ color: fw.color }}
                >
                  {fw.word}
                </span>
              </div>
            ))
        )}
      </div>
    </div>
  );
}
