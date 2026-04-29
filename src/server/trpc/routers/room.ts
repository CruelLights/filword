import { z } from "zod";
import { TRPCError } from "@trpc/server";
import { eq, and, desc, gt } from "drizzle-orm";
import { nanoid } from "nanoid";
import { createTRPCRouter, protectedProcedure } from "../init";
import { gameRooms, gameParticipants, userStats } from "@/server/db/schema";
import { generateRoomCode } from "@/server/game/utils";

const PLAYER_COLORS = [
  "#3B82F6", "#EF4444", "#10B981", "#F59E0B", "#8B5CF6", "#EC4899",
];

const TEAM_COLORS = ["#3B82F6", "#EF4444"]; // Синяя и красная команды
const BOT_USER_ID = "bot-player-000000000000000000000";

export const roomRouter = createTRPCRouter({
  create: protectedProcedure
    .input(z.object({
      maxPlayers: z.number().int().min(2).max(6).default(4),
      durationSeconds: z.number().int().min(60).max(300).default(120),
      teamMode: z.boolean().default(false),
      withBot: z.boolean().default(false),
      botSpeed: z.enum(["slow", "medium", "fast"]).default("medium"),
    }))
    .mutation(async ({ ctx, input }) => {
      const roomId = nanoid(10);
      const code = generateRoomCode();

      await ctx.db.insert(gameRooms).values({
        id: roomId, code, hostId: ctx.user.id,
        maxPlayers: input.maxPlayers,
        durationSeconds: input.durationSeconds,
        teamMode: input.teamMode,
        status: "waiting",
      });

      await ctx.db.insert(gameParticipants).values({
        id: nanoid(), roomId, userId: ctx.user.id,
        playerColor: input.teamMode ? TEAM_COLORS[0]! : PLAYER_COLORS[0]!,
        playerIndex: 0,
        teamId: input.teamMode ? 1 : null,
      });

      if (input.withBot) {
        await ctx.db.insert(gameParticipants).values({
          id: nanoid(), roomId, userId: BOT_USER_ID,
          playerColor: PLAYER_COLORS[1]!, playerIndex: 1,
          isBot: true,
        }).catch(() => {});
      }

      await ctx.db.insert(userStats).values({ userId: ctx.user.id }).onConflictDoNothing();

      return { roomId, code };
    }),

  join: protectedProcedure
    .input(z.object({ code: z.string().length(6) }))
    .mutation(async ({ ctx, input }) => {
      const room = await ctx.db.query.gameRooms.findFirst({
        where: eq(gameRooms.code, input.code.toUpperCase()),
        with: { participants: true },
      });

      if (!room) throw new TRPCError({ code: "NOT_FOUND", message: "Комната не найдена" });
      if (room.status !== "waiting") {
        throw new TRPCError({ code: "PRECONDITION_FAILED", message: "Игра уже началась" });
      }
      if (room.participants.filter(p => !p.isBot).length >= room.maxPlayers) {
        throw new TRPCError({ code: "PRECONDITION_FAILED", message: "Комната заполнена" });
      }

      const existing = room.participants.find((p) => p.userId === ctx.user.id);
      if (existing) return { roomId: room.id };

      const playerIndex = room.participants.length;
      // В командном режиме новый игрок по умолчанию без команды (null)
      const teamId = room.teamMode ? null : null;

      await ctx.db.insert(gameParticipants).values({
        id: nanoid(), roomId: room.id, userId: ctx.user.id,
        playerColor: PLAYER_COLORS[playerIndex % PLAYER_COLORS.length]!,
        playerIndex,
        teamId,
      });

      await ctx.db.insert(userStats).values({ userId: ctx.user.id }).onConflictDoNothing();

      return { roomId: room.id };
    }),

  // Выбор команды
  selectTeam: protectedProcedure
    .input(z.object({
      roomId: z.string(),
      teamId: z.number().int().min(1).max(2),
    }))
    .mutation(async ({ ctx, input }) => {
      const room = await ctx.db.query.gameRooms.findFirst({
        where: eq(gameRooms.id, input.roomId),
        with: { participants: true },
      });

      if (!room) throw new TRPCError({ code: "NOT_FOUND" });
      if (!room.teamMode) throw new TRPCError({ code: "BAD_REQUEST", message: "Не командный режим" });
      if (room.status !== "waiting") throw new TRPCError({ code: "PRECONDITION_FAILED" });

      const participant = room.participants.find((p) => p.userId === ctx.user.id);
      if (!participant) throw new TRPCError({ code: "FORBIDDEN" });

      const teamColor = TEAM_COLORS[input.teamId - 1]!;

      await ctx.db.update(gameParticipants)
        .set({ teamId: input.teamId, playerColor: teamColor })
        .where(eq(gameParticipants.id, participant.id));

      // Уведомляем всех через WS
      try {
        const { broadcast } = await import("@/server/ws/broadcast");
        broadcast(input.roomId, {
          type: "player_team_changed",
          roomId: input.roomId,
          userId: ctx.user.id,
          teamId: input.teamId,
          color: teamColor,
        });
      } catch {}

      return { ok: true };
    }),

  get: protectedProcedure
    .input(z.object({ roomId: z.string() }))
    .query(async ({ ctx, input }) => {
      const room = await ctx.db.query.gameRooms.findFirst({
        where: eq(gameRooms.id, input.roomId),
        with: {
          participants: { with: { user: true } },
          host: true,
        },
      });

      if (!room) throw new TRPCError({ code: "NOT_FOUND" });
      const { wordList, ...safeRoom } = room;

      return {
        ...safeRoom,
        isHost: room.hostId === ctx.user.id,
        myParticipant: room.participants.find((p) => p.userId === ctx.user.id),
      };
    }),

  list: protectedProcedure.query(async ({ ctx }) => {
    const oneHourAgo = new Date(Date.now() - 60 * 60 * 1000);

    const rooms = await ctx.db.query.gameRooms.findMany({
      where: and(eq(gameRooms.status, "waiting"), gt(gameRooms.createdAt, oneHourAgo)),
      with: { participants: true, host: true },
      orderBy: [desc(gameRooms.createdAt)],
      limit: 20,
    });

    return rooms
      .filter((r) => r.participants.filter((p) => !p.isBot).length > 0)
      .map((r) => ({
        id: r.id, code: r.code, hostName: r.host.name,
        playerCount: r.participants.filter((p) => !p.isBot).length,
        maxPlayers: r.maxPlayers,
        durationSeconds: r.durationSeconds,
        teamMode: r.teamMode,
      }));
  }),

  leave: protectedProcedure
    .input(z.object({ roomId: z.string() }))
    .mutation(async ({ ctx, input }) => {
      const room = await ctx.db.query.gameRooms.findFirst({
        where: eq(gameRooms.id, input.roomId),
      });

      if (!room || room.status !== "waiting") return { ok: true };

      if (room.hostId === ctx.user.id) {
        // Хост выходит — удаляем всю комнату
        await ctx.db.delete(gameParticipants)
          .where(eq(gameParticipants.roomId, input.roomId));
        await ctx.db.delete(gameRooms)
          .where(eq(gameRooms.id, input.roomId));
      } else {
        // Обычный игрок — удаляем только его
        await ctx.db.delete(gameParticipants)
          .where(and(
            eq(gameParticipants.roomId, input.roomId),
            eq(gameParticipants.userId, ctx.user.id)
          ));
      }

      return { ok: true };
    }),
});