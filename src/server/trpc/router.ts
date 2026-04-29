import { createTRPCRouter } from "./init";
import { authRouter } from "./routers/auth";
import { roomRouter } from "./routers/room";
import { gameRouter } from "./routers/game";
import { statsRouter } from "./routers/stats";

export const appRouter = createTRPCRouter({
  auth: authRouter,
  room: roomRouter,
  game: gameRouter,
  stats: statsRouter,
});

export type AppRouter = typeof appRouter;
