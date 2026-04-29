import type { WebSocket } from "ws";
import type { ServerMessage } from "./types";
import { roomManager } from "./room-manager";

export function send(ws: WebSocket, message: ServerMessage) {
  if (ws.readyState === ws.OPEN) {
    ws.send(JSON.stringify(message));
  }
}

export function broadcast(roomId: string, message: ServerMessage) {
  const clients = roomManager.getRoomClients(roomId);
  const data = JSON.stringify(message);
  for (const ws of clients) {
    if (ws.readyState === ws.OPEN) {
      ws.send(data);
    }
  }
}

export function broadcastExcept(roomId: string, excludeWs: WebSocket, message: ServerMessage) {
  const clients = roomManager.getRoomClients(roomId);
  const data = JSON.stringify(message);
  for (const ws of clients) {
    if (ws !== excludeWs && ws.readyState === ws.OPEN) {
      ws.send(data);
    }
  }
}
