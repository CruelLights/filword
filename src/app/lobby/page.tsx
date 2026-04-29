"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { trpc } from "@/lib/trpc";
import { useSession, signOut } from "@/lib/auth-client";
import { FloatingEmojis } from "@/components/floating-emojis";
import Link from "next/link";

function playersLabel(n: number): string {
  if (n === 1) return "1 игрок";
  if (n >= 2 && n <= 4) return `${n} игрока`;
  return `${n} игроков`;
}

export default function LobbyPage() {
  const router = useRouter();
  const { data: session, isPending } = useSession();
  const [joinCode, setJoinCode] = useState("");
  const [maxPlayers, setMaxPlayers] = useState(4);
  const [duration, setDuration] = useState(120);
  const [withBot, setWithBot] = useState(false);
  const [botSpeed, setBotSpeed] = useState<"slow" | "medium" | "fast">("medium");
  const [teamMode, setTeamMode] = useState(false);

  const { data: rooms, refetch } = trpc.room.list.useQuery(undefined, {
    refetchInterval: 5000,
  });

  const createRoom = trpc.room.create.useMutation({
    onSuccess: ({ roomId }) => router.push(`/room/${roomId}`),
  });

  const joinRoom = trpc.room.join.useMutation({
    onSuccess: ({ roomId }) => router.push(`/room/${roomId}`),
  });

  async function handleSignOut() {
    await signOut();
    router.push("/");
    router.refresh();
  }

  if (isPending) {
  return (
    <main className="flex min-h-screen items-center justify-center relative">
      <FloatingEmojis />
      <p className="text-gray-400 animate-pulse relative z-10">Загрузка...</p>
    </main>
  );
}

if (!session?.user) {
  return (
    <main className="flex min-h-screen items-center justify-center p-8 relative">
      <FloatingEmojis />
      <div className="text-center space-y-4 relative z-10">
        <p className="text-gray-400">Нужно войти чтобы играть</p>
        <Link href="/login" className="btn-primary">Войти</Link>
      </div>
    </main>
  );
}

  return (
    <main className="min-h-screen p-8 relative">
      <FloatingEmojis />
      <div className="max-w-2xl mx-auto space-y-6 relative z-10">

        <div className="flex items-center justify-between">
          <div>
            <h1 className="text-3xl font-bold text-white">Лобби</h1>
            <p className="text-gray-400 text-sm mt-1">Привет, {session.user.name}!</p>
          </div>
          <div className="flex gap-2">
            <Link href="/stats" className="btn-secondary text-sm">🏆 Статистика</Link>
            <button onClick={handleSignOut} className="btn-secondary text-sm">Выйти</button>
          </div>
        </div>

        {/* Создать комнату */}
        <div className="card space-y-4">
          <h2 className="text-lg font-semibold text-white">Создать комнату</h2>
          <div className="grid grid-cols-2 gap-4">
            <div>
              <label className="block text-sm text-gray-400 mb-1">Игроков</label>
              <select
                value={maxPlayers}
                onChange={(e) => setMaxPlayers(Number(e.target.value))}
                className="input"
                disabled={withBot}
              >
                {[2, 3, 4, 5, 6].map((n) => (
                  <option key={n} value={n}>{playersLabel(n)}</option>
                ))}
              </select>
            </div>
            <div>
              <label className="block text-sm text-gray-400 mb-1">Время</label>
              <select value={duration} onChange={(e) => setDuration(Number(e.target.value))} className="input">
                <option value={60}>1 минута</option>
                <option value={120}>2 минуты</option>
                <option value={180}>3 минуты</option>
                <option value={300}>5 минут</option>
              </select>
            </div>
          </div>

          {/* Командный режим */}
          <div className="flex items-center justify-between p-3 bg-gray-800 rounded-xl">
            <div className="flex items-center gap-3">
              <span className="text-xl">👥</span>
              <div>
                <p className="text-white text-sm font-medium">Командный режим</p>
                <p className="text-gray-500 text-xs">Игроки выбирают команды</p>
              </div>
            </div>
            <button
              onClick={() => { setTeamMode(!teamMode); if (!teamMode) setWithBot(false); }}
              style={{
                position: "relative", width: "44px", height: "24px",
                borderRadius: "12px", backgroundColor: teamMode ? "#7c3aed" : "#4b5563",
                border: "none", cursor: "pointer", transition: "background-color 0.2s", flexShrink: 0,
              }}
            >
              <span style={{
                position: "absolute", top: "3px", left: teamMode ? "23px" : "3px",
                width: "18px", height: "18px", backgroundColor: "white",
                borderRadius: "50%", transition: "left 0.2s", display: "block",
              }} />
            </button>
          </div>

          {/* Бот */}
          {!teamMode && (
            <div className="bg-gray-800 rounded-xl p-3 space-y-3">
              <div className="flex items-center justify-between">
                <div className="flex items-center gap-3">
                  <span className="text-xl">🤖</span>
                  <div>
                    <p className="text-white text-sm font-medium">Добавить бота</p>
                    <p className="text-gray-500 text-xs">Играй один против компьютера</p>
                  </div>
                </div>
                <button
                  onClick={() => setWithBot(!withBot)}
                  style={{
                    position: "relative", width: "44px", height: "24px",
                    borderRadius: "12px", backgroundColor: withBot ? "#2563eb" : "#4b5563",
                    border: "none", cursor: "pointer", transition: "background-color 0.2s", flexShrink: 0,
                  }}
                >
                  <span style={{
                    position: "absolute", top: "3px", left: withBot ? "23px" : "3px",
                    width: "18px", height: "18px", backgroundColor: "white",
                    borderRadius: "50%", transition: "left 0.2s", display: "block",
                  }} />
                </button>
              </div>
              {withBot && (
                <div>
                  <label className="block text-xs text-gray-400 mb-2">Скорость бота</label>
                  <div className="grid grid-cols-3 gap-2">
                    {(["slow", "medium", "fast"] as const).map((speed) => (
                      <button
                        key={speed}
                        onClick={() => setBotSpeed(speed)}
                        className={`py-1.5 rounded-lg text-sm transition-colors ${botSpeed === speed ? "bg-blue-600 text-white" : "bg-gray-700 text-gray-400 hover:bg-gray-600"}`}
                      >
                        {speed === "slow" ? "🐢 Медленно" : speed === "medium" ? "🐇 Средне" : "⚡ Быстро"}
                      </button>
                    ))}
                  </div>
                </div>
              )}
            </div>
          )}

          <button
            className="btn-primary w-full"
            onClick={() => createRoom.mutate({
              maxPlayers: withBot ? 2 : maxPlayers,
              durationSeconds: duration,
              teamMode,
              withBot: !teamMode && withBot,
              botSpeed,
            })}
            disabled={createRoom.isPending}
          >
            {createRoom.isPending ? "Создание..." : teamMode ? "Создать команды" : withBot ? "Играть с ботом" : "Создать игру"}
          </button>
          {createRoom.error && <p className="text-sm text-red-400">{createRoom.error.message}</p>}
        </div>

        {/* Войти по коду */}
        <div className="card space-y-4">
          <h2 className="text-lg font-semibold text-white">Войти по коду</h2>
          <div className="flex gap-3">
            <input
              type="text"
              value={joinCode}
              onChange={(e) => setJoinCode(e.target.value.toUpperCase())}
              className="input flex-1 font-mono text-xl tracking-widest text-center"
              placeholder="AB3K7X"
              maxLength={6}
            />
            <button
              className="btn-primary px-6"
              onClick={() => joinRoom.mutate({ code: joinCode })}
              disabled={joinCode.length !== 6 || joinRoom.isPending}
            >
              Войти
            </button>
          </div>
          {joinRoom.error && <p className="text-sm text-red-400">{joinRoom.error.message}</p>}
        </div>

        {/* Открытые комнаты */}
        <div className="card space-y-4">
          <div className="flex items-center justify-between">
            <h2 className="text-lg font-semibold text-white">Открытые комнаты</h2>
            <button onClick={() => refetch()} className="text-xs text-gray-500 hover:text-gray-300">Обновить</button>
          </div>
          {!rooms || rooms.length === 0 ? (
            <p className="text-gray-600 text-sm text-center py-4">Нет открытых комнат. Создайте свою!</p>
          ) : (
            <div className="space-y-2">
              {rooms.map((room) => (
                <div key={room.id} className="flex items-center justify-between p-3 rounded-lg bg-gray-800 border border-gray-700">
                  <div>
                    <span className="font-mono font-bold text-white">{room.code}</span>
                    <span className="text-gray-400 text-sm ml-3">
                      {room.hostName} · {room.playerCount}/{room.maxPlayers} игроков
                    </span>
                  </div>
                  <button
                    className="btn-secondary text-sm py-1 px-3"
                    onClick={() => joinRoom.mutate({ code: room.code })}
                    disabled={joinRoom.isPending}
                  >
                    Войти
                  </button>
                </div>
              ))}
            </div>
          )}
        </div>

      </div>
    </main>
  );
}