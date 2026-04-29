import { z } from "zod";
import { eq, desc, sql } from "drizzle-orm";
import { createTRPCRouter, protectedProcedure, publicProcedure } from "../init";
import { userStats, matchHistory, users, gameRooms, foundWords, gameParticipants } from "@/server/db/schema";

export const statsRouter = createTRPCRouter({
  // Global leaderboard
  leaderboard: publicProcedure
    .input(z.object({ limit: z.number().int().min(1).max(50).default(10) }))
    .query(async ({ ctx, input }) => {
      const rows = await ctx.db
        .select({
          userId: userStats.userId,
          name: users.name,
          gamesPlayed: userStats.gamesPlayed,
          gamesWon: userStats.gamesWon,
          totalWordsFound: userStats.totalWordsFound,
          bestScore: userStats.bestScore,
        })
        .from(userStats)
        .innerJoin(users, eq(userStats.userId, users.id))
        .orderBy(desc(userStats.totalWordsFound))
        .limit(input.limit);

      return rows.map((r, i) => ({ ...r, rank: i + 1 }));
    }),

  // My stats
  mine: protectedProcedure.query(async ({ ctx }) => {
    const stats = await ctx.db.query.userStats.findFirst({
      where: eq(userStats.userId, ctx.user.id),
    });

    const history = await ctx.db
      .select({
        id: matchHistory.id,
        roomId: matchHistory.roomId,
        winnerId: matchHistory.winnerId,
        totalWords: matchHistory.totalWords,
        durationSeconds: matchHistory.durationSeconds,
        playerCount: matchHistory.playerCount,
        finalScores: matchHistory.finalScores,
        playedAt: matchHistory.playedAt,
      })
      .from(matchHistory)
      .orderBy(desc(matchHistory.playedAt))
      .limit(10);

    // Filter matches where this user participated
    const myHistory = history.filter(
      (h) => h.finalScores && typeof h.finalScores === "object" && ctx.user.id in h.finalScores
    );

    return {
      stats: stats ?? {
        userId: ctx.user.id,
        gamesPlayed: 0,
        gamesWon: 0,
        totalWordsFound: 0,
        bestScore: 0,
        avgTimePerWordMs: 0,
        updatedAt: new Date(),
      },
      recentMatches: myHistory.map((h) => ({
        id: h.id,
        isWin: h.winnerId === ctx.user.id,
        myScore: (h.finalScores as Record<string, number>)[ctx.user.id] ?? 0,
        totalWords: h.totalWords,
        playerCount: h.playerCount,
        durationSeconds: h.durationSeconds,
        playedAt: h.playedAt,
      })),
    };
  }),
});
