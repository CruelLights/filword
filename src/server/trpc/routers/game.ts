import { z } from "zod";
import { TRPCError } from "@trpc/server";
import { eq } from "drizzle-orm";
import { nanoid } from "nanoid";
import { createTRPCRouter, protectedProcedure } from "../init";
import { gameRooms, gameParticipants, foundWords } from "@/server/db/schema";
import { generateGrid } from "@/server/game/generator";
import { validateWordSubmission } from "@/server/game/validator";

const WS_INTERNAL_URL = "https://filword-production.up.railway.app";

export const gameRouter = createTRPCRouter({
  start: protectedProcedure
    .input(z.object({ roomId: z.string() }))
    .mutation(async ({ ctx, input }) => {
      const room = await ctx.db.query.gameRooms.findFirst({
        where: eq(gameRooms.id, input.roomId),
        with: { participants: true },
      });

      if (!room) throw new TRPCError({ code: "NOT_FOUND" });
      if (room.hostId !== ctx.user.id) {
        throw new TRPCError({ code: "FORBIDDEN", message: "Только хост может начать игру" });
      }
      if (room.status !== "waiting") {
        throw new TRPCError({ code: "PRECONDITION_FAILED", message: "Игра уже запущена" });
      }

      const realPlayers = room.participants.filter((p) => !p.isBot);
      if (realPlayers.length < 1) {
        throw new TRPCError({ code: "PRECONDITION_FAILED", message: "Нужен минимум 1 игрок" });
      }

      const hasBot = room.participants.some((p) => p.isBot);
      if (!hasBot && realPlayers.length < 2) {
        throw new TRPCError({ code: "PRECONDITION_FAILED", message: "Нужно минимум 2 игрока" });
      }

      const { grid, placements } = generateGrid(room.gridSize);
      const startedAt = new Date();

      await ctx.db.update(gameRooms)
        .set({ status: "active", grid, wordList: placements, startedAt })
        .where(eq(gameRooms.id, input.roomId));
        console.log("WS_INTERNAL_URL:", process.env.WS_INTERNAL_URL);
        console.log("Sending to:", `${WS_INTERNAL_URL}/internal/start-timer`);
      try {
        await fetch(`${WS_INTERNAL_URL}/internal/start-timer`, {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({
            roomId: input.roomId,
            durationSeconds: room.durationSeconds,
            grid,
            botSpeed: hasBot ? "medium" : null,
          }),
        });
      } catch (err) {
        console.error("Failed to notify WS server:", err);
      }

      const { broadcast } = await import("@/server/ws/broadcast");
      broadcast(input.roomId, {
        type: "game_started",
        roomId: input.roomId,
        grid,
        startedAt: startedAt.toISOString(),
        durationSeconds: room.durationSeconds,
        totalWordCount: placements.length,
      });

      return { grid, startedAt, durationSeconds: room.durationSeconds, totalWordCount: placements.length };
    }),

  getState: protectedProcedure
    .input(z.object({ roomId: z.string() }))
    .query(async ({ ctx, input }) => {
      const room = await ctx.db.query.gameRooms.findFirst({
        where: eq(gameRooms.id, input.roomId),
        with: {
          participants: { with: { user: true } },
          foundWords: { with: { participant: true } },
        },
      });

      if (!room) throw new TRPCError({ code: "NOT_FOUND" });

      return {
        status: room.status,
        grid: room.grid,
        durationSeconds: room.durationSeconds,
        startedAt: room.startedAt,
        participants: room.participants.map((p) => ({
          id: p.id, userId: p.userId,
          name: p.isBot ? "🤖 Бот" : p.user.name,
          color: p.playerColor, score: p.score,
          teamId: p.teamId, playerIndex: p.playerIndex,
          isBot: p.isBot,
        })),
        foundWords: room.foundWords.map((fw) => ({
          word: fw.word, startRow: fw.startRow, startCol: fw.startCol,
          direction: fw.direction, length: fw.length,
          participantId: fw.participantId, color: fw.participant.playerColor,
          foundAt: fw.foundAt,
        })),
        totalWordCount: room.wordList?.length ?? 0,
      };
    }),

  submitWord: protectedProcedure
    .input(z.object({
      roomId: z.string(),
      startRow: z.number().int().min(0).max(9),
      startCol: z.number().int().min(0).max(9),
      endRow: z.number().int().min(0).max(9),
      endCol: z.number().int().min(0).max(9),
    }))
    .mutation(async ({ ctx, input }) => {
      const room = await ctx.db.query.gameRooms.findFirst({
        where: eq(gameRooms.id, input.roomId),
        with: { participants: true, foundWords: true },
      });

      if (!room) throw new TRPCError({ code: "NOT_FOUND" });
      if (room.status !== "active") {
        throw new TRPCError({ code: "PRECONDITION_FAILED", message: "Игра не активна" });
      }
      if (!room.grid || !room.wordList) throw new TRPCError({ code: "INTERNAL_SERVER_ERROR" });

      const participant = room.participants.find((p) => p.userId === ctx.user.id);
      if (!participant) throw new TRPCError({ code: "FORBIDDEN" });

      const result = validateWordSubmission({
        grid: room.grid as string[][], wordList: room.wordList as any[],
        foundWords: room.foundWords,
        startRow: input.startRow, startCol: input.startCol,
        endRow: input.endRow, endCol: input.endCol,
      });

      if (!result.valid) throw new TRPCError({ code: "BAD_REQUEST", message: result.error });

      const timeMs = room.startedAt ? Date.now() - room.startedAt.getTime() : 0;

      await ctx.db.insert(foundWords).values({
        id: nanoid(), roomId: input.roomId, participantId: participant.id,
        userId: ctx.user.id, word: result.placement!.word,
        startRow: result.placement!.startRow, startCol: result.placement!.startCol,
        direction: result.placement!.direction, length: result.placement!.length,
        timeMs,
      });

      await ctx.db.update(gameParticipants)
        .set({ score: participant.score + 1 })
        .where(eq(gameParticipants.id, participant.id));

      return {
        word: result.placement!.word,
        participantId: participant.id,
        color: participant.playerColor,
      };
    }),
});