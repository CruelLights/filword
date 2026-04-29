"use client";

import { trpc } from "@/lib/trpc";
import { useSession } from "@/lib/auth-client";
import Link from "next/link";

export default function StatsPage() {
  const { data: session } = useSession();
  const { data: leaderboard, isLoading: lbLoading } = trpc.stats.leaderboard.useQuery({ limit: 10 });
  const { data: myStats, isLoading: myLoading } = trpc.stats.mine.useQuery(undefined, {
    enabled: !!session?.user,
  });

  return (
    <main className="min-h-screen p-8">
      <div className="max-w-4xl mx-auto space-y-8">

        <div className="flex items-center justify-between">
          <h1 className="text-3xl font-bold text-white">Статистика</h1>
          <Link href="/lobby" className="btn-secondary text-sm">← Лобби</Link>
        </div>

        <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">

          {/* My stats */}
          {session?.user && (
            <div className="card space-y-4">
              <h2 className="text-lg font-semibold text-white">Мои результаты</h2>
              {myLoading ? (
                <p className="text-gray-500 animate-pulse">Загрузка...</p>
              ) : myStats ? (
                <>
                  <div className="grid grid-cols-2 gap-3">
                    <StatCard label="Игр сыграно" value={myStats.stats.gamesPlayed} />
                    <StatCard label="Побед" value={myStats.stats.gamesWon} color="text-green-400" />
                    <StatCard label="Слов найдено" value={myStats.stats.totalWordsFound} color="text-blue-400" />
                    <StatCard label="Лучший счёт" value={myStats.stats.bestScore} color="text-amber-400" />
                  </div>

                  {myStats.stats.gamesPlayed > 0 && (
                    <div className="bg-gray-800 rounded-lg p-3">
                      <p className="text-xs text-gray-400 mb-1">Процент побед</p>
                      <div className="flex items-center gap-3">
                        <div className="flex-1 bg-gray-700 rounded-full h-2">
                          <div
                            className="bg-green-500 h-2 rounded-full transition-all"
                            style={{
                              width: `${Math.round((myStats.stats.gamesWon / myStats.stats.gamesPlayed) * 100)}%`
                            }}
                          />
                        </div>
                        <span className="text-white text-sm font-medium">
                          {Math.round((myStats.stats.gamesWon / myStats.stats.gamesPlayed) * 100)}%
                        </span>
                      </div>
                    </div>
                  )}

                  {myStats.recentMatches.length > 0 && (
                    <div>
                      <h3 className="text-sm font-medium text-gray-400 mb-2">Последние игры</h3>
                      <div className="space-y-2">
                        {myStats.recentMatches.map((m) => (
                          <div key={m.id} className="flex items-center justify-between p-2 rounded-lg bg-gray-800">
                            <div className="flex items-center gap-2">
                              <span className={`text-xs font-bold px-2 py-0.5 rounded ${m.isWin ? "bg-green-900 text-green-400" : "bg-gray-700 text-gray-400"}`}>
                                {m.isWin ? "ПОБЕДА" : "ПОРАЖЕНИЕ"}
                              </span>
                              <span className="text-gray-400 text-xs">{m.playerCount} игроков</span>
                            </div>
                            <div className="text-right">
                              <p className="text-white text-sm font-medium">{m.myScore} слов</p>
                              <p className="text-gray-500 text-xs">
                                {new Date(m.playedAt).toLocaleDateString("ru-RU")}
                              </p>
                            </div>
                          </div>
                        ))}
                      </div>
                    </div>
                  )}
                </>
              ) : (
                <p className="text-gray-500 text-sm">Нет данных. Сыграйте первую игру!</p>
              )}
            </div>
          )}

          {/* Leaderboard */}
          <div className="card space-y-4">
            <h2 className="text-lg font-semibold text-white">🏆 Лидерборд</h2>
            {lbLoading ? (
              <p className="text-gray-500 animate-pulse">Загрузка...</p>
            ) : !leaderboard || leaderboard.length === 0 ? (
              <p className="text-gray-600 text-sm text-center py-4">Пока нет данных</p>
            ) : (
              <div className="space-y-2">
                {leaderboard.map((row, index) => (
                  <div
                    key={row.userId}
                    className={`flex items-center gap-3 p-2 rounded-lg ${row.userId === session?.user?.id ? "bg-gray-800 border border-gray-600" : "bg-gray-800/50"}`}
                  >
                    <span className="text-lg w-8 text-center">
                      {index === 0 ? "🥇" : index === 1 ? "🥈" : index === 2 ? "🥉" : `#${index + 1}`}
                    </span>
                    <div className="flex-1 min-w-0">
                      <p className="text-white text-sm font-medium truncate">{row.name}</p>
                      <p className="text-gray-500 text-xs">{row.gamesPlayed} игр · {row.gamesWon} побед</p>
                    </div>
                    <div className="text-right">
                      <p className="text-blue-400 font-bold">{row.totalWordsFound}</p>
                      <p className="text-gray-500 text-xs">слов</p>
                    </div>
                  </div>
                ))}
              </div>
            )}
          </div>

        </div>
      </div>
    </main>
  );
}

function StatCard({ label, value, color = "text-white" }: { label: string; value: number; color?: string }) {
  return (
    <div className="bg-gray-800 rounded-lg p-3 text-center">
      <p className={`text-2xl font-bold ${color}`}>{value}</p>
      <p className="text-gray-400 text-xs mt-1">{label}</p>
    </div>
  );
}
