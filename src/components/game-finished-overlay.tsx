"use client";

import { useRouter } from "next/navigation";
import type { GameResult, TeamResult } from "@/server/ws/types";

type Props = {
  results: GameResult[];
  myUserId: string;
  teamResults?: TeamResult[];
};

const TEAM_NAMES: Record<number, string> = {
  1: "Синяя команда",
  2: "Красная команда",
};

export function GameFinishedOverlay({ results, myUserId, teamResults }: Props) {
  const router = useRouter();
  const isTeamMode = !!teamResults && teamResults.length > 0;

  const myResult = results.find((r) => r.userId === myUserId);
  const winner = isTeamMode ? teamResults![0] : results[0];
  const myTeam = myResult?.teamId;
  const isWinner = isTeamMode
    ? myTeam === teamResults![0]?.teamId
    : winner && "userId" in winner && (winner as GameResult).userId === myUserId;

  return (
    <div className="fixed inset-0 bg-black/80 backdrop-blur-sm flex items-center justify-center z-50 p-4">
      <div className="bg-gray-900 border border-gray-700 rounded-2xl p-8 max-w-md w-full space-y-6">
        <div className="text-center">
          <div className="text-4xl mb-2">{isWinner ? "🏆" : "🎮"}</div>
          <h2 className="text-2xl font-bold text-white">
            {isWinner ? "Победа!" : "Игра окончена"}
          </h2>
          {myResult && (
            <p className="text-gray-400 mt-1">Вы нашли {myResult.score} слов</p>
          )}
        </div>

        {/* Командные результаты */}
        {isTeamMode && teamResults && (
          <div className="space-y-2">
            <p className="text-gray-400 text-sm text-center">Счёт команд</p>
            {teamResults.map((tr, i) => (
              <div
                key={tr.teamId}
                className="flex items-center gap-3 p-3 rounded-xl"
                style={{
                  backgroundColor: `${tr.color}22`,
                  border: `1px solid ${tr.color}44`,
                }}
              >
                <span className="text-lg">{i === 0 ? "🥇" : "🥈"}</span>
                <div className="w-3 h-3 rounded-full" style={{ backgroundColor: tr.color }} />
                <span className="flex-1 text-white font-medium">{TEAM_NAMES[tr.teamId]}</span>
                <span className="font-bold text-lg" style={{ color: tr.color }}>{tr.score}</span>
              </div>
            ))}
          </div>
        )}

        {/* Личные результаты */}
        <div className="space-y-2">
          <p className="text-gray-400 text-sm text-center">
            {isTeamMode ? "Личный счёт" : "Результаты"}
          </p>
          {results.map((r, i) => (
            <div
              key={r.userId}
              className={`flex items-center gap-3 p-3 rounded-xl ${r.userId === myUserId ? "bg-gray-800 border border-gray-600" : "bg-gray-800/50"}`}
            >
              <span className="text-lg font-bold text-gray-400 w-8 text-center">
                {!isTeamMode && (i === 0 ? "🥇" : i === 1 ? "🥈" : i === 2 ? "🥉" : `#${i + 1}`)}
                {isTeamMode && <div className="w-3 h-3 rounded-full mx-auto" style={{ backgroundColor: r.color }} />}
              </span>
              <span className="flex-1 text-white font-medium">{r.name}</span>
              <span className="font-bold text-lg" style={{ color: r.color }}>{r.score}</span>
            </div>
          ))}
        </div>

        <div className="space-y-3">
          <button className="btn-primary w-full" onClick={() => router.push("/lobby")}>
            Играть снова
          </button>
          <button className="btn-secondary w-full" onClick={() => router.push("/")}>
            На главную
          </button>
        </div>
      </div>
    </div>
  );
}