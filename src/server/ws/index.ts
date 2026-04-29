#!/usr/bin/env node
import { startWebSocketServer } from "./server.js";
import * as dotenv from "dotenv";

dotenv.config({ path: ".env.local" });

startWebSocketServer();

process.on("SIGINT", () => {
  console.log("\nОстановка WebSocket сервера...");
  process.exit(0);
});
