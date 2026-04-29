import { WebSocketServer, WebSocket } from "ws";
import { createServer } from "http";
import { handleMessage, finishGame, startBot } from "./handler";
import { roomManager } from "./room-manager";
import { db } from "@/server/db";
import { sessions, users } from "@/server/db/schema";
import { eq } from "drizzle-orm";

const WS_PORT = parseInt(process.env.WS_PORT || "3001", 10);

export function startWebSocketServer() {
  const httpServer = createServer(async (req, res) => {
    if (req.method === "POST" && req.url === "/internal/start-timer") {
      let body = "";
      req.on("data", (chunk) => { body += chunk; });
      req.on("end", async () => {
        try {
          const { roomId, durationSeconds, grid, botSpeed } = JSON.parse(body);
          console.log("Internal: starting timer for room:", roomId, durationSeconds, "sec");

          roomManager.startGame(roomId, grid, durationSeconds);

          // Запускаем бота если указана скорость
          if (botSpeed) {
            await startBot(roomId, botSpeed);
          }

          const handle = setTimeout(() => {
            console.log("Timer expired for room:", roomId);
            finishGame(roomId);
          }, durationSeconds * 1000);
          roomManager.setTimer(roomId, handle);

          res.writeHead(200);
          res.end(JSON.stringify({ ok: true }));
        } catch (err) {
          console.error("Internal endpoint error:", err);
          res.writeHead(500);
          res.end(JSON.stringify({ error: String(err) }));
        }
      });
      return;
    }
    res.writeHead(404);
    res.end();
  });

  const wss = new WebSocketServer({ server: httpServer });

  httpServer.listen(WS_PORT, () => {
    console.log(`✓ WebSocket сервер запущен на порту ${WS_PORT}`);
  });

  wss.on("connection", async (ws: WebSocket, req) => {
    const url = new URL(req.url!, `http://localhost`);
    const token = url.searchParams.get("token");

    if (!token) { ws.close(4001, "Требуется авторизация"); return; }

    try {
      const session = await db.query.sessions.findFirst({
        where: eq(sessions.token, token),
      });

      if (!session || new Date(session.expiresAt) < new Date()) {
        ws.close(4001, "Неверный токен"); return;
      }

      const user = await db.query.users.findFirst({
        where: eq(users.id, session.userId),
      });

      if (!user) { ws.close(4001, "Пользователь не найден"); return; }

      roomManager.registerClient(ws, user.id, user.name);
      console.log(`✓ Клиент подключён: ${user.name}`);

      ws.send(JSON.stringify({ type: "pong" }));

      ws.on("message", (data) => {
        const raw = data.toString();
        console.log(`MSG [${user.name}]:`, raw.slice(0, 120));
        handleMessage(ws, raw).catch(console.error);
      });

      ws.on("close", (code) => {
        roomManager.removeClient(ws);
        console.log(`Клиент отключился: ${user.name}, код: ${code}`);
      });

      ws.on("error", console.error);

    } catch (err) {
      console.error("WS auth error:", err);
      ws.close(4001, "Ошибка авторизации");
    }
  });

  return wss;
}
