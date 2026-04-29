"use client";

import { useParams, useRouter } from "next/navigation";
import { useState, useCallback, useRef, useEffect } from "react";
import { trpc } from "@/lib/trpc";
import { useWebSocket } from "@/lib/use-websocket";
import { useSession } from "@/lib/auth-client";
import { GameBoard } from "@/components/game-board";
import { GameTimer } from "@/components/game-timer";
import { Scoreboard } from "@/components/scoreboard";
import { TeamScoreboard } from "@/components/team-scoreboard";
import { FoundWordsList } from "@/components/found-words-list";
import { GameFinishedOverlay } from "@/components/game-finished-overlay";
import type { ServerMessage, RoomState, GameResult, WsPlayer, TeamResult } from "@/server/ws/types";
import Link from "next/link";

export default function RoomPage() {
  const params = useParams();
  const router = useRouter();
  const roomId = params.roomId as string;
  const { data: session } = useSession();

  const [roomState, setRoomState] = useState<RoomState | null>(null);
  const [gameResults, setGameResults] = useState<GameResult[] | null>(null);
  const [teamResults, setTeamResults] = useState<TeamResult[] | null>(null);
  const [notification, setNotification] = useState<{ text: string; color: string } | null>(null);
  const [totalWordCount, setTotalWordCount] = useState(0);
  const notifTimeout = useRef<NodeJS.Timeout | null>(null);

  const { data: room, isLoading, refetch: refetchRoom } = trpc.room.get.useQuery(
    { roomId },
    {
      refetchOnWindowFocus: true,
      refetchInterval: (query) => query.state.data?.status === "waiting" ? 2000 : false,
    }
  );

  const { data: gameState } = trpc.game.getState.useQuery(
    { roomId },
    {
      enabled: !!roomId,
      refetchOnWindowFocus: true,
      refetchInterval: (query) =>
        query.state.data?.status === "active" || roomState?.status === "active" ? false : 500,
    }
  );

  const startGame = trpc.game.start.useMutation();
  const selectTeam = trpc.room.selectTeam.useMutation({
    onSuccess: () => refetchRoom(),
  });
  const leaveRoom = trpc.room.leave.useMutation();

  const myUserId = session?.user?.id ?? "";
  const myParticipant = room?.participants?.find((p) => p.userId === myUserId);
  const myColor = myParticipant?.playerColor ?? "#3B82F6";
  const isTeamMode = room?.teamMode ?? false;

  const notify = useCallback((text: string, color: string) => {
    if (notifTimeout.current) clearTimeout(notifTimeout.current);
    setNotification({ text, color });
    notifTimeout.current = setTimeout(() => setNotification(null), 2500);
  }, []);

  const handleWsMessage = useCallback((msg: ServerMessage) => {
    switch (msg.type) {
      case "room_state":
        setRoomState(msg.state);
        break;
      case "player_joined":
        setRoomState((prev) =>
          prev ? { ...prev, players: [...prev.players.filter((p) => p.userId !== msg.player.userId), msg.player] } : null
        );
        break;
      case "player_left":
        setRoomState((prev) =>
          prev ? { ...prev, players: prev.players.filter((p) => p.userId !== msg.userId) } : null
        );
        break;
      case "player_team_changed":
        setRoomState((prev) => {
          if (!prev) return null;
          return {
            ...prev,
            players: prev.players.map((p) =>
              p.userId === msg.userId ? { ...p, teamId: msg.teamId, color: msg.color } : p
            ),
          };
        });
        break;
      case "game_started":
        setRoomState((prev) => ({
          status: "active",
          grid: msg.grid,
          startedAt: msg.startedAt,
          durationSeconds: msg.durationSeconds,
          players: prev?.players ?? [],
          foundWords: prev?.foundWords ?? [],
          teamMode: isTeamMode,
        }));
        setTotalWordCount(msg.totalWordCount);
        break;
      case "word_found":
        setRoomState((prev) => {
          if (!prev) return null;
          return {
            ...prev,
            foundWords: [...prev.foundWords, msg.word],
            players: prev.players.map((p) =>
              p.userId === msg.word.userId ? { ...p, score: p.score + 1 } : p
            ),
          };
        });
        notify(msg.word.word, msg.word.color);
        break;
      case "game_finished":
        setRoomState((prev) => (prev ? { ...prev, status: "finished" } : null));
        setGameResults(msg.results);
        if (msg.teamResults) setTeamResults(msg.teamResults);
        break;
      case "error":
        notify(msg.message, "#EF4444");
        break;
    }
  }, [notify, isTeamMode]);

  const { isConnected, send } = useWebSocket({ roomId, onMessage: handleWsMessage });

  useEffect(() => {
    if (gameState?.totalWordCount && gameState.totalWordCount > 0) {
      setTotalWordCount(gameState.totalWordCount);
    }
    if (
      gameState?.status === "active" &&
      gameState.grid &&
      gameState.startedAt &&
      roomState?.status !== "active"
    ) {
      setRoomState({
        status: "active",
        grid: gameState.grid as string[][],
        startedAt: new Date(gameState.startedAt).toISOString(),
        durationSeconds: gameState.durationSeconds,
        players: gameState.participants.map((p) => ({
          userId: p.userId, name: p.name, color: p.color,
          score: p.score, playerIndex: p.playerIndex, teamId: p.teamId,
        })),
        foundWords: gameState.foundWords.map((fw) => ({
          word: fw.word, startRow: fw.startRow, startCol: fw.startCol,
          direction: fw.direction, length: fw.length,
          participantId: fw.participantId, userId: fw.participantId,
          color: fw.color,
          foundAt: typeof fw.foundAt === "string" ? fw.foundAt : new Date(fw.foundAt).toISOString(),
        })),
        teamMode: isTeamMode,
      });
    }
  }, [gameState, roomState?.status, isTeamMode]);

  const handleSubmitWord = useCallback((startRow: number, startCol: number, endRow: number, endCol: number) => {
    send({ type: "submit_word", roomId, startRow, startCol, endRow, endCol });
  }, [send, roomId]);

  async function handleStart() {
    try {
      const result = await startGame.mutateAsync({ roomId });
      const startedAt = new Date(result.startedAt).toISOString();
      setTotalWordCount(result.totalWordCount);
      setRoomState((prev) => ({
        status: "active",
        grid: result.grid as string[][],
        startedAt,
        durationSeconds: result.durationSeconds,
        players: prev?.players ?? [],
        foundWords: prev?.foundWords ?? [],
        teamMode: isTeamMode,
      }));
    } catch (err: any) {
      notify(err.message, "#EF4444");
    }
  }

  function handleSelectTeam(teamId: number) {
    selectTeam.mutate({ roomId, teamId });
    // Оптимистично обновляем WS state
    const color = teamId === 1 ? "#3B82F6" : "#EF4444";
    setRoomState((prev) =>
      prev ? {
        ...prev,
        players: prev.players.map((p) =>
          p.userId === myUserId ? { ...p, teamId, color } : p
        ),
      } : null
    );
  }

  const currentGrid = roomState?.grid ?? null;
  const currentStatus = roomState?.status ?? gameState?.status ?? "waiting";
  const currentPlayers: WsPlayer[] = roomState?.players ?? gameState?.participants?.map((p) => ({
    userId: p.userId, name: p.name, color: p.color,
    score: p.score, playerIndex: p.playerIndex, teamId: p.teamId,
  })) ?? [];
  const currentFoundWords = roomState?.foundWords ?? [];
  const currentStartedAt = roomState?.startedAt ?? null;
  const currentDuration = roomState?.durationSeconds ?? gameState?.durationSeconds ?? 120;
  const wordCount = totalWordCount;

  // Проверяем можно ли начать игру в командном режиме
  const team1Count = room?.participants?.filter((p) => p.teamId === 1).length ?? 0;
  const team2Count = room?.participants?.filter((p) => p.teamId === 2).length ?? 0;
  const canStart = isTeamMode
    ? team1Count >= 1 && team2Count >= 1
    : (room?.participants?.filter(p => !p.isBot).length ?? 0) >= 2 || room?.participants?.some(p => p.isBot);

  if (isLoading) {
    return (
      <div className="flex min-h-screen items-center justify-center">
        <p className="text-gray-400 animate-pulse">Загрузка...</p>
      </div>
    );
  }

  return (
    <main className="min-h-screen bg-gray-950 p-4">
      {gameResults && (
        <GameFinishedOverlay
          results={gameResults}
          myUserId={myUserId}
          teamResults={teamResults ?? undefined}
        />
      )}

      {notification && (
        <div
          className="fixed top-4 left-1/2 -translate-x-1/2 z-40 px-4 py-2 rounded-full text-sm font-medium shadow-lg animate-fade-in"
          style={{
            backgroundColor: `${notification.color}22`,
            border: `1px solid ${notification.color}66`,
            color: notification.color,
          }}
        >
          {notification.text}
        </div>
      )}

      <div className="max-w-6xl mx-auto">
        <div className="flex items-center justify-between mb-4">
          <div className="flex items-center gap-3">
            <button
              onClick={async () => {
                if (currentStatus === "waiting") {
                  await leaveRoom.mutateAsync({ roomId }).catch(() => {});
                }
                router.push("/lobby");
              }}
              className="text-gray-500 hover:text-gray-300 text-sm"
            >
              ← Лобби
            </button>
            <span className="font-mono text-lg font-bold text-white">{room?.code}</span>
            {isTeamMode && <span className="text-xs bg-purple-900 text-purple-300 px-2 py-0.5 rounded">Команды</span>}
            <div className={`w-2 h-2 rounded-full ${isConnected ? "bg-green-500" : "bg-red-500"}`} />
          </div>

          {currentStatus === "active" && currentStartedAt && (
            <GameTimer startedAt={currentStartedAt} durationSeconds={currentDuration} />
          )}

          {currentStatus === "waiting" && room?.isHost && (
            <button
              className="btn-primary"
              onClick={handleStart}
              disabled={!canStart || startGame.isPending}
              title={!canStart && isTeamMode ? "Нужен хотя бы 1 игрок в каждой команде" : ""}
            >
              {startGame.isPending ? "Запуск..." : "Начать игру"}
            </button>
          )}

          {currentStatus === "waiting" && !room?.isHost && (
            <span className="text-gray-500 text-sm">Ожидание хоста...</span>
          )}
        </div>

        {currentStatus === "active" && currentGrid ? (
          <div className="grid grid-cols-1 lg:grid-cols-[1fr_240px] gap-4">
            <div className="card p-3">
              <GameBoard
                grid={currentGrid}
                foundWords={currentFoundWords}
                myColor={myColor}
                onSubmit={handleSubmitWord}
                disabled={!isConnected}
              />
            </div>
            <div className="space-y-4">
              <div className="card">
                <h3 className="text-sm font-medium text-gray-400 mb-3">
                  {isTeamMode ? "Счёт команд" : "Счёт"}
                </h3>
                {isTeamMode
                  ? <TeamScoreboard players={currentPlayers} myUserId={myUserId} />
                  : <Scoreboard players={currentPlayers} myUserId={myUserId} />
                }
              </div>
              <div className="card">
                <FoundWordsList foundWords={currentFoundWords} totalWords={wordCount} />
              </div>
            </div>
          </div>

        ) : currentStatus === "waiting" ? (
          <div className="card max-w-lg mx-auto space-y-6 py-6 px-6">
            <div className="text-center">
              <h2 className="text-xl font-bold text-white mb-1">Ожидание игроков</h2>
              <p className="text-gray-400 text-sm">
                {room?.participants?.filter(p => !p.isBot).length ?? 0} / {room?.maxPlayers ?? 4} игроков
              </p>
            </div>

            {/* Командный режим — выбор команды */}
            {isTeamMode ? (
              <div className="space-y-3">
                <p className="text-gray-400 text-sm text-center">Выбери команду:</p>
                <div className="grid grid-cols-2 gap-3">
                  {[1, 2].map((teamId) => {
                    const teamColor = teamId === 1 ? "#3B82F6" : "#EF4444";
                    const teamName = teamId === 1 ? "Синяя" : "Красная";
                    const teamPlayers = room?.participants?.filter((p) => p.teamId === teamId) ?? [];
                    const isMyTeam = myParticipant?.teamId === teamId;

                    return (
                      <button
                        key={teamId}
                        onClick={() => handleSelectTeam(teamId)}
                        disabled={selectTeam.isPending || isMyTeam}
                        className="rounded-xl p-3 border-2 transition-all text-left"
                        style={{
                          borderColor: isMyTeam ? teamColor : "#374151",
                          backgroundColor: isMyTeam ? `${teamColor}22` : "transparent",
                        }}
                      >
                        <div className="flex items-center gap-2 mb-2">
                          <div className="w-3 h-3 rounded-full" style={{ backgroundColor: teamColor }} />
                          <span className="text-white text-sm font-medium">{teamName} команда</span>
                          {isMyTeam && <span className="text-xs ml-auto" style={{ color: teamColor }}>✓</span>}
                        </div>
                        <div className="space-y-1">
                          {teamPlayers.length === 0 ? (
                            <p className="text-xs text-gray-600">Нет игроков</p>
                          ) : (
                            teamPlayers.map((p) => (
                              <p key={p.userId} className="text-xs text-gray-400">{p.user.name}</p>
                            ))
                          )}
                        </div>
                      </button>
                    );
                  })}
                </div>
                {!canStart && room?.isHost && (
                  <p className="text-xs text-amber-400 text-center">
                    Нужен хотя бы 1 игрок в каждой команде
                  </p>
                )}
              </div>
            ) : (
              /* Обычный режим — список игроков */
              <div className="space-y-2">
                {room?.participants?.map((p) => (
                  <div key={p.userId} className="flex items-center gap-3 p-2 rounded-lg bg-gray-800">
                    <div className="w-3 h-3 rounded-full" style={{ backgroundColor: p.playerColor }} />
                    <span className="text-white text-sm">{p.isBot ? "🤖 Бот" : p.user.name}</span>
                    {p.userId === room.hostId && (
                      <span className="ml-auto text-xs text-blue-400">ХОСТ</span>
                    )}
                  </div>
                ))}
              </div>
            )}

            <div className="bg-gray-800 rounded-xl p-4 text-center">
              <p className="text-gray-400 text-xs mb-2">Код для приглашения</p>
              <p className="font-mono text-3xl font-bold text-white tracking-widest">{room?.code}</p>
            </div>
          </div>

        ) : currentStatus === "finished" ? (
          <div className="card max-w-md mx-auto text-center py-8">
            <p className="text-white text-xl font-bold">Игра завершена</p>
            <button className="btn-primary mt-4" onClick={() => router.push("/lobby")}>В лобби</button>
          </div>
        ) : null}
      </div>
    </main>
  );
}