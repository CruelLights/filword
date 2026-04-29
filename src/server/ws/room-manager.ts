import type { WebSocket } from "ws";
import type { WsPlayer, WordFoundPayload, RoomState } from "./types";

type ConnectedClient = {
  ws: WebSocket;
  userId: string;
  name: string;
  roomId: string | null;
};

type RoomData = {
  roomId: string;
  status: "waiting" | "starting" | "active" | "finished";
  players: Map<string, WsPlayer>;
  clients: Map<string, WebSocket>;
  foundWords: WordFoundPayload[];
  grid: string[][] | null;
  startedAt: Date | null;
  durationSeconds: number;
  timerHandle: ReturnType<typeof setTimeout> | null;
};

export class RoomManager {
  private rooms = new Map<string, RoomData>();
  private clients = new Map<WebSocket, ConnectedClient>();

  registerClient(ws: WebSocket, userId: string, name: string) {
    this.clients.set(ws, { ws, userId, name, roomId: null });
  }

  removeClient(ws: WebSocket): string | null {
    const client = this.clients.get(ws);
    if (!client) return null;
    if (client.roomId) this.leaveRoom(ws, client.roomId);
    this.clients.delete(ws);
    return client.userId;
  }

  getClient(ws: WebSocket): ConnectedClient | undefined {
    return this.clients.get(ws);
  }

  joinRoom(ws: WebSocket, roomId: string, player: WsPlayer) {
    const client = this.clients.get(ws);
    if (!client) return;

    if (!this.rooms.has(roomId)) {
      this.rooms.set(roomId, {
        roomId, status: "waiting",
        players: new Map(), clients: new Map(),
        foundWords: [], grid: null, startedAt: null,
        durationSeconds: 120, timerHandle: null,
      });
    }

    const room = this.rooms.get(roomId)!;
    room.players.set(client.userId, player);
    room.clients.set(client.userId, ws);
    client.roomId = roomId;
  }

  // Добавляем бота в список игроков без WS соединения
  addBotPlayer(roomId: string, player: WsPlayer) {
    if (!this.rooms.has(roomId)) {
      this.rooms.set(roomId, {
        roomId, status: "waiting",
        players: new Map(), clients: new Map(),
        foundWords: [], grid: null, startedAt: null,
        durationSeconds: 120, timerHandle: null,
      });
    }
    const room = this.rooms.get(roomId)!;
    room.players.set(player.userId, player);
  }

  leaveRoom(ws: WebSocket, roomId: string) {
    const client = this.clients.get(ws);
    if (!client) return;
    const room = this.rooms.get(roomId);
    if (!room) return;

    room.clients.delete(client.userId);
    client.roomId = null;

    if (room.clients.size === 0 && room.status !== "active" && room.status !== "finished") {
      if (room.timerHandle) clearTimeout(room.timerHandle);
      this.rooms.delete(roomId);
    }
  }

  startGame(roomId: string, grid: string[][], durationSeconds: number) {
    const room = this.rooms.get(roomId);
    if (!room) return;
    if (room.status === "active") return;
    room.status = "active";
    room.grid = grid;
    room.startedAt = new Date();
    room.durationSeconds = durationSeconds;
    room.foundWords = [];
  }

  addFoundWord(roomId: string, word: WordFoundPayload) {
    const room = this.rooms.get(roomId);
    if (!room) return;
    const exists = room.foundWords.some(
      (fw) => fw.word === word.word && fw.startRow === word.startRow && fw.startCol === word.startCol
    );
    if (!exists) {
      room.foundWords.push(word);
      const player = room.players.get(word.userId);
      if (player) {
        player.score += 1;
        room.players.set(word.userId, player);
      }
    }
  }

  finishGame(roomId: string) {
    const room = this.rooms.get(roomId);
    if (!room) return;
    room.status = "finished";
    if (room.timerHandle) {
      clearTimeout(room.timerHandle);
      room.timerHandle = null;
    }
  }

  setTimer(roomId: string, handle: ReturnType<typeof setTimeout>) {
    const room = this.rooms.get(roomId);
    if (room) room.timerHandle = handle;
  }

  getRoom(roomId: string): RoomData | undefined {
    return this.rooms.get(roomId);
  }

  getRoomClients(roomId: string): WebSocket[] {
    const room = this.rooms.get(roomId);
    if (!room) return [];
    return Array.from(room.clients.values());
  }

  getRoomState(roomId: string): RoomState | null {
    const room = this.rooms.get(roomId);
    if (!room) return null;
    return {
      status: room.status,
      players: Array.from(room.players.values()),
      foundWords: room.foundWords,
      grid: room.grid,
      startedAt: room.startedAt?.toISOString() ?? null,
      durationSeconds: room.durationSeconds,
    };
  }

  updatePlayerScore(roomId: string, userId: string, score: number) {
    const room = this.rooms.get(roomId);
    if (!room) return;
    const player = room.players.get(userId);
    if (player) {
      player.score = score;
      room.players.set(userId, player);
    }
  }
}

export const roomManager = new RoomManager();
