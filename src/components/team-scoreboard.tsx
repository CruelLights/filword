"use client";

import type { WsPlayer } from "@/server/ws/types";

type Props = {
  players: WsPlayer[];
  myUserId: string;
};

const TEAM_COLORS: Record<number, string> = {
  1: "#3B82F6",
  2: "#EF4444",
};

const TEAM_NAMES: Record<number, string> = {
  1: "Синяя команда",
  2: "Красная команда",
};

export function TeamScoreboard({ players, myUserId }: Props) {
  const team1 = players.filter((p) => p.teamId === 1);
  const team2 = players.filter((p) => p.teamId === 2);
  const noTeam = players.filter((p) => !p.teamId);

  const team1Score = team1.reduce((sum, p) => sum + p.score, 0);
  const team2Score = team2.reduce((sum, p) => sum + p.score, 0);

  return (
    <div className="space-y-3">
      {[{ id: 1, players: team1, score: team1Score }, { id: 2, players: team2, score: team2Score }].map(({ id, players: teamPlayers, score }) => (
        <div key={id} className="rounded-lg overflow-hidden border border-gray-700">
          <div
            className="flex items-center justify-between px-3 py-2"
            style={{ backgroundColor: `${TEAM_COLORS[id]}22`, borderBottom: `1px solid ${TEAM_COLORS[id]}44` }}
          >
            <span className="text-sm font-medium" style={{ color: TEAM_COLORS[id] }}>
              {TEAM_NAMES[id]}
            </span>
            <span className="text-lg font-bold" style={{ color: TEAM_COLORS[id] }}>
              {score}
            </span>
          </div>
          <div className="divide-y divide-gray-800">
            {teamPlayers.length === 0 ? (
              <p className="text-xs text-gray-600 text-center py-2">Нет игроков</p>
            ) : (
              teamPlayers.map((p) => (
                <div key={p.userId} className={`flex items-center gap-2 px-3 py-1.5 ${p.userId === myUserId ? "bg-gray-800" : ""}`}>
                  <span className="text-gray-300 text-xs flex-1 truncate">
                    {p.name}
                    {p.userId === myUserId && <span className="text-gray-500 ml-1">(вы)</span>}
                  </span>
                  <span className="text-xs font-mono text-gray-400">{p.score}</span>
                </div>
              ))
            )}
          </div>
        </div>
      ))}

      {noTeam.length > 0 && (
        <div className="text-xs text-gray-500 text-center">
          Без команды: {noTeam.map(p => p.name).join(", ")}
        </div>
      )}
    </div>
  );
}