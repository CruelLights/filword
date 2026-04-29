import type { WebSocket } from "ws";
import type { ClientMessage } from "./types";
import { roomManager } from "./room-manager";
import { broadcast, send } from "./broadcast";
import { db } from "@/server/db";
import { gameRooms, gameParticipants, foundWords, matchHistory, userStats } from "@/server/db/schema";
import { eq, sql } from "drizzle-orm";
import { validateWordSubmission } from "@/server/game/validator";
import { nanoid } from "nanoid";
import { GameBot, botManager, type BotSpeed } from "@/server/game/bot";
import type { WordPlacement } from "@/server/db/schema";

const BOT_USER_ID = "bot-player-000000000000000000000";

export async function handleMessage(ws: WebSocket, raw: string) {
  let msg: ClientMessage;
  try {
    msg = JSON.parse(raw) as ClientMessage;
  } catch {
    send(ws, { type: "error", message: "Неверный формат сообщения" });
    return;
  }

  switch (msg.type) {
    case "ping":
      send(ws, { type: "pong" });
      break;
    case "join_room":
      await handleJoinRoom(ws, msg.roomId);
      break;
    case "leave_room":
      await handleLeaveRoom(ws, msg.roomId);
      break;
    case "submit_word":
      await handleSubmitWord(ws, msg);
      break;
  }
}

async function handleJoinRoom(ws: WebSocket, roomId: string) {
  const client = roomManager.getClient(ws);
  if (!client) return;

  const room = await db.query.gameRooms.findFirst({
    where: eq(gameRooms.id, roomId),
    with: {
      participants: { with: { user: true } },
      foundWords: { with: { participant: true } },
    },
  });

  if (!room) { send(ws, { type: "error", message: "Комната не найдена" }); return; }

  const participant = room.participants.find((p) => p.userId === client.userId);
  if (!participant) { send(ws, { type: "error", message: "Вы не участник этой комнаты" }); return; }

  roomManager.joinRoom(ws, roomId, {
    userId: client.userId,
    name: client.name,
    color: participant.playerColor,
    score: participant.score,
    playerIndex: participant.playerIndex,
    teamId: participant.teamId,
  });

  // Добавляем бота в состояние комнаты если есть
  const botParticipant = room.participants.find((p) => p.isBot);
  if (botParticipant) {
    const existingRoom = roomManager.getRoom(roomId);
    if (existingRoom && !existingRoom.players.has(BOT_USER_ID)) {
      roomManager.addBotPlayer(roomId, {
        userId: BOT_USER_ID,
        name: "🤖 Бот",
        color: botParticipant.playerColor,
        score: botParticipant.score,
        playerIndex: botParticipant.playerIndex,
        teamId: botParticipant.teamId,
      });
    }
  }

  if (room.status === "active" && room.grid) {
    const wsRoom = roomManager.getRoom(roomId);
    if (wsRoom && wsRoom.status !== "active") {
      roomManager.startGame(roomId, room.grid as string[][], room.durationSeconds);
      for (const fw of room.foundWords) {
        roomManager.addFoundWord(roomId, {
          word: fw.word, startRow: fw.startRow, startCol: fw.startCol,
          direction: fw.direction, length: fw.length,
          participantId: fw.participantId, userId: fw.userId,
          color: fw.participant.playerColor, foundAt: fw.foundAt.toISOString(),
        });
      }
    }
  }

  const state = roomManager.getRoomState(roomId);
  if (state) send(ws, { type: "room_state", roomId, state });

  broadcast(roomId, {
    type: "player_joined", roomId,
    player: {
      userId: client.userId, name: client.name, color: participant.playerColor,
      score: participant.score, playerIndex: participant.playerIndex, teamId: participant.teamId,
    },
  });

  send(ws, { type: "room_joined", roomId, playerId: participant.id });
}

async function handleLeaveRoom(ws: WebSocket, roomId: string) {
  const client = roomManager.getClient(ws);
  if (!client) return;
  roomManager.leaveRoom(ws, roomId);
  broadcast(roomId, { type: "player_left", roomId, userId: client.userId });
}

async function handleSubmitWord(ws: WebSocket, msg: Extract<ClientMessage, { type: "submit_word" }>) {
  const client = roomManager.getClient(ws);
  if (!client) return;

  const room = roomManager.getRoom(msg.roomId);
  if (!room || room.status !== "active") {
    send(ws, { type: "error", message: "Игра не активна" });
    return;
  }

  const dbRoom = await db.query.gameRooms.findFirst({
    where: eq(gameRooms.id, msg.roomId),
    with: { participants: true, foundWords: true },
  });

  if (!dbRoom?.grid || !dbRoom.wordList) return;

  const participant = dbRoom.participants.find((p) => p.userId === client.userId);
  if (!participant) return;

  const result = validateWordSubmission({
    grid: dbRoom.grid as string[][], wordList: dbRoom.wordList as any[],
    foundWords: dbRoom.foundWords,
    startRow: msg.startRow, startCol: msg.startCol,
    endRow: msg.endRow, endCol: msg.endCol,
  });

  if (!result.valid || !result.placement) {
    send(ws, { type: "error", message: result.error ?? "Неверное слово" });
    return;
  }

  await saveFoundWord(msg.roomId, participant.id, client.userId, participant.playerColor, participant.score, result.placement, room);
}

// Общая функция сохранения найденного слова (используется и для бота)
async function saveFoundWord(
  roomId: string,
  participantId: string,
  userId: string,
  color: string,
  currentScore: number,
  placement: WordPlacement,
  room: ReturnType<typeof roomManager.getRoom>
) {
  if (!room) return;

  const timeMs = room.startedAt ? Date.now() - room.startedAt.getTime() : 0;
  const wordId = nanoid();
  const foundAt = new Date();

  await db.insert(foundWords).values({
    id: wordId, roomId, participantId, userId,
    word: placement.word,
    startRow: placement.startRow, startCol: placement.startCol,
    direction: placement.direction, length: placement.length,
    timeMs, foundAt,
  });

  await db.update(gameParticipants)
    .set({ score: currentScore + 1 })
    .where(eq(gameParticipants.id, participantId));

  const wordPayload = {
    word: placement.word, startRow: placement.startRow,
    startCol: placement.startCol, direction: placement.direction,
    length: placement.length, participantId, userId, color,
    foundAt: foundAt.toISOString(),
  };

  roomManager.addFoundWord(roomId, wordPayload);
  botManager.markWordFound(roomId, placement.word);
  broadcast(roomId, { type: "word_found", roomId, word: wordPayload });

  // Проверяем не закончились ли все слова
  const dbRoom = await db.query.gameRooms.findFirst({
    where: eq(gameRooms.id, roomId),
    with: { foundWords: true },
  });
  if (dbRoom) {
    const dbWordCount = (dbRoom.wordList as any[])?.length ?? 0;
    if (dbRoom.foundWords.length >= dbWordCount) {
      await finishGame(roomId);
    }
  }
}

// Запуск бота
export async function startBot(roomId: string, speed: BotSpeed = "medium") {
  const dbRoom = await db.query.gameRooms.findFirst({
    where: eq(gameRooms.id, roomId),
    with: {
      participants: true,
      foundWords: true,
    },
  });

  if (!dbRoom?.wordList) return;

  const botParticipant = dbRoom.participants.find((p) => p.isBot);
  if (!botParticipant) return;

  const foundWordSet = new Set(dbRoom.foundWords.map((fw) => fw.word));

  const bot = new GameBot({
    roomId,
    botUserId: BOT_USER_ID,
    wordList: dbRoom.wordList as WordPlacement[],
    foundWords: foundWordSet,
    speed,
    onWordFound: async (placement) => {
      const room = roomManager.getRoom(roomId);
      if (!room || room.status !== "active") return;

      // Перепроверяем что слово ещё не найдено
      const currentDbRoom = await db.query.gameRooms.findFirst({
        where: eq(gameRooms.id, roomId),
        with: { foundWords: true, participants: true },
      });
      if (!currentDbRoom) return;

      const alreadyFound = currentDbRoom.foundWords.some((fw) => fw.word === placement.word);
      if (alreadyFound) return;

      const botParticipant = currentDbRoom.participants.find((p) => p.isBot);
      if (!botParticipant) return;

      await saveFoundWord(
        roomId, botParticipant.id, BOT_USER_ID,
        botParticipant.playerColor, botParticipant.score,
        placement, room
      );
    },
    onStop: () => {
      console.log(`Bot stopped for room ${roomId}`);
    },
  });

  botManager.add(roomId, bot);
  bot.start();
  console.log(`Bot started for room ${roomId} with speed: ${speed}`);
}

export async function finishGame(roomId: string) {
  const room = roomManager.getRoom(roomId);
  if (!room || room.status === "finished") return;

  roomManager.finishGame(roomId);
  botManager.remove(roomId);

  await db.update(gameRooms)
    .set({ status: "finished", finishedAt: new Date() })
    .where(eq(gameRooms.id, roomId));

  // Считаем слова и среднее время для каждого игрока
  const wordsByPlayer: Record<string, number> = {};
  const totalTimeMsByPlayer: Record<string, number> = {};

  for (const fw of room.foundWords) {
    wordsByPlayer[fw.userId] = (wordsByPlayer[fw.userId] ?? 0) + 1;
    totalTimeMsByPlayer[fw.userId] = (totalTimeMsByPlayer[fw.userId] ?? 0) + 0; // накапливаем
  }

  // Загружаем timeMs из БД для подсчёта скорости
  const dbFoundWords = await db.query.foundWords.findMany
    ? await db.select({ userId: foundWords.userId, timeMs: foundWords.timeMs })
        .from(foundWords)
        .where(eq(foundWords.roomId, roomId))
    : [];

  const timeSumByPlayer: Record<string, number> = {};
  for (const fw of dbFoundWords) {
    timeSumByPlayer[fw.userId] = (timeSumByPlayer[fw.userId] ?? 0) + fw.timeMs;
  }

  const results = Array.from(room.players.values())
    .map((p) => {
      const score = wordsByPlayer[p.userId] ?? 0;
      const totalTime = timeSumByPlayer[p.userId] ?? 0;
      // Среднее время на слово (меньше = быстрее)
      const avgTimeMs = score > 0 ? Math.round(totalTime / score) : 999999999;
      return { userId: p.userId, name: p.name, color: p.color, score, teamId: p.teamId, avgTimeMs };
    })
    .sort((a, b) => {
      // Сначала по очкам (больше = лучше)
      if (b.score !== a.score) return b.score - a.score;
      // При равенстве — по скорости (меньше времени = лучше)
      return a.avgTimeMs - b.avgTimeMs;
    });

  const winner = results[0];
  const finalScores: Record<string, number> = {};
  results.forEach((r) => { finalScores[r.userId] = r.score; });

  // Убираем avgTimeMs перед отправкой клиенту
  const clientResults = results.map(({ avgTimeMs, ...r }) => r);

  // Считаем командные результаты если командный режим
  const teamScores: Record<number, number> = {};
  const teamTimeSums: Record<number, number> = {};
  const teamWordCounts: Record<number, number> = {};
  for (const r of results) {
    if (r.teamId) {
      teamScores[r.teamId] = (teamScores[r.teamId] ?? 0) + r.score;
      teamTimeSums[r.teamId] = (teamTimeSums[r.teamId] ?? 0) + (r.avgTimeMs * r.score);
      teamWordCounts[r.teamId] = (teamWordCounts[r.teamId] ?? 0) + r.score;
    }
  }

  const TEAM_COLORS: Record<number, string> = { 1: "#3B82F6", 2: "#EF4444" };
  const hasTeams = Object.keys(teamScores).length > 0;

  const teamResults = hasTeams
    ? Object.entries(teamScores)
        .map(([teamId, score]) => ({
          teamId: Number(teamId),
          color: TEAM_COLORS[Number(teamId)] ?? "#888",
          score,
          players: results.filter(r => r.teamId === Number(teamId)).map(r => r.name),
        }))
        .sort((a, b) => {
          if (b.score !== a.score) return b.score - a.score;
          const aAvg = teamWordCounts[a.teamId] ? (teamTimeSums[a.teamId] ?? 0) / teamWordCounts[a.teamId] : 999999;
          const bAvg = teamWordCounts[b.teamId] ? (teamTimeSums[b.teamId] ?? 0) / teamWordCounts[b.teamId] : 999999;
          return aAvg - bAvg;
        })
    : [];

  const winnerTeamId = teamResults[0]?.teamId ?? null;

  await db.insert(matchHistory).values({
    id: nanoid(), roomId,
    winnerId: hasTeams ? null : winner?.userId ?? null,
    winnerTeamId: hasTeams ? winnerTeamId : null,
    totalWords: room.foundWords.length, durationSeconds: room.durationSeconds,
    playerCount: results.filter(r => r.userId !== BOT_USER_ID).length,
    teamMode: hasTeams, finalScores,
  }).catch(console.error);

  // Обновляем статистику только для реальных игроков
  for (const player of results.filter(r => r.userId !== BOT_USER_ID)) {
    const playerScore = wordsByPlayer[player.userId] ?? 0;
    const isWinner = hasTeams
      ? player.teamId === winnerTeamId
      : player.userId === winner?.userId;

    await db.insert(userStats)
      .values({
        userId: player.userId, gamesPlayed: 1,
        gamesWon: isWinner ? 1 : 0,
        totalWordsFound: playerScore, bestScore: playerScore, avgTimePerWordMs: 0,
      })
      .onConflictDoUpdate({
        target: userStats.userId,
        set: {
          gamesPlayed: sql`${userStats.gamesPlayed} + 1`,
          gamesWon: isWinner ? sql`${userStats.gamesWon} + 1` : userStats.gamesWon,
          totalWordsFound: sql`${userStats.totalWordsFound} + ${playerScore}`,
          bestScore: sql`GREATEST(${userStats.bestScore}, ${playerScore})`,
          updatedAt: new Date(),
        },
      }).catch(console.error);
  }

  broadcast(roomId, {
    type: "game_finished",
    roomId,
    results: clientResults,
    ...(hasTeams ? { teamResults } : {}),
  });
}