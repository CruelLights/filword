"use client";

import type { WsPlayer } from "@/server/ws/types";

type Props = {
  players: WsPlayer[];
  myUserId: string;
};

export function Scoreboard({ players, myUserId }: Props) {
  const sorted = [...players].sort((a, b) => b.score - a.score);

  return (
    <div className="space-y-2">
      {sorted.map((player, i) => (
        <div
          key={player.userId}
          className={`
            flex items-center gap-3 p-2 rounded-lg
            ${player.userId === myUserId ? "bg-gray-800 border border-gray-600" : "bg-gray-900"}
          `}
        >
          {/* Rank */}
          <span className="text-gray-500 text-sm w-5 text-center font-mono">
            {i + 1}
          </span>

          {/* Color dot */}
          <div
            className="w-3 h-3 rounded-full flex-shrink-0"
            style={{ backgroundColor: player.color }}
          />

          {/* Name */}
          <span className={`flex-1 text-sm truncate ${player.userId === myUserId ? "text-white font-medium" : "text-gray-300"}`}>
            {player.name}
            {player.userId === myUserId && (
              <span className="ml-1 text-xs text-gray-500">(вы)</span>
            )}
          </span>

          {/* Score */}
          <span
            className="text-sm font-bold tabular-nums"
            style={{ color: player.color }}
          >
            {player.score}
          </span>
        </div>
      ))}
    </div>
  );
}
