import {
  pgTable,
  text,
  integer,
  boolean,
  timestamp,
  jsonb,
  index,
  pgEnum,
} from "drizzle-orm/pg-core";
import { relations } from "drizzle-orm";

export const gameStatusEnum = pgEnum("game_status", [
  "waiting",
  "starting",
  "active",
  "finished",
]);

export const gameDirectionEnum = pgEnum("game_direction", [
  "horizontal",
  "vertical",
  "diagonal_down",
  "diagonal_up",
]);

// ── Better-auth tables ──────────────────────────────────────────────────────

export const users = pgTable("users", {
  id: text("id").primaryKey(),
  name: text("name").notNull(),
  email: text("email").notNull().unique(),
  emailVerified: boolean("email_verified").notNull().default(false),
  image: text("image"),
  createdAt: timestamp("created_at").notNull().defaultNow(),
  updatedAt: timestamp("updated_at").notNull().defaultNow(),
});

export const sessions = pgTable("sessions", {
  id: text("id").primaryKey(),
  token: text("token").notNull().unique(),
  expiresAt: timestamp("expires_at").notNull(),
  ipAddress: text("ip_address"),
  userAgent: text("user_agent"),
  userId: text("user_id")
    .notNull()
    .references(() => users.id, { onDelete: "cascade" }),
  createdAt: timestamp("created_at").notNull().defaultNow(),
  updatedAt: timestamp("updated_at").notNull().defaultNow(),
});

export const accounts = pgTable("accounts", {
  id: text("id").primaryKey(),
  accountId: text("account_id").notNull(),
  providerId: text("provider_id").notNull(),
  userId: text("user_id")
    .notNull()
    .references(() => users.id, { onDelete: "cascade" }),
  accessToken: text("access_token"),
  refreshToken: text("refresh_token"),
  idToken: text("id_token"),
  expiresAt: timestamp("expires_at"),
  password: text("password"),
  createdAt: timestamp("created_at").notNull().defaultNow(),
  updatedAt: timestamp("updated_at").notNull().defaultNow(),
});

export const verifications = pgTable("verifications", {
  id: text("id").primaryKey(),
  identifier: text("identifier").notNull(),
  value: text("value").notNull(),
  expiresAt: timestamp("expires_at").notNull(),
  createdAt: timestamp("created_at").notNull().defaultNow(),
  updatedAt: timestamp("updated_at").notNull().defaultNow(),
});

// ── Game tables ─────────────────────────────────────────────────────────────

export const gameRooms = pgTable(
  "game_rooms",
  {
    id: text("id").primaryKey(),
    code: text("code").notNull().unique(),
    hostId: text("host_id").notNull().references(() => users.id),
    status: gameStatusEnum("status").notNull().default("waiting"),
    maxPlayers: integer("max_players").notNull().default(4),
    durationSeconds: integer("duration_seconds").notNull().default(120),
    gridSize: integer("grid_size").notNull().default(10),
    teamMode: boolean("team_mode").notNull().default(false),
    grid: jsonb("grid").$type<string[][]>(),
    wordList: jsonb("word_list").$type<WordPlacement[]>(),
    startedAt: timestamp("started_at"),
    finishedAt: timestamp("finished_at"),
    createdAt: timestamp("created_at").notNull().defaultNow(),
  },
  (t) => [
    index("game_rooms_status_idx").on(t.status),
    index("game_rooms_code_idx").on(t.code),
  ]
);

export const gameParticipants = pgTable(
  "game_participants",
  {
    id: text("id").primaryKey(),
    roomId: text("room_id").notNull().references(() => gameRooms.id, { onDelete: "cascade" }),
    userId: text("user_id").notNull().references(() => users.id, { onDelete: "cascade" }),
    isBot: boolean("is_bot").notNull().default(false),
    teamId: integer("team_id"),
    playerColor: text("player_color").notNull(),
    playerIndex: integer("player_index").notNull(),
    score: integer("score").notNull().default(0),
    joinedAt: timestamp("joined_at").notNull().defaultNow(),
  },
  (t) => [
    index("game_participants_room_idx").on(t.roomId),
    index("game_participants_user_idx").on(t.userId),
  ]
);

export const foundWords = pgTable(
  "found_words",
  {
    id: text("id").primaryKey(),
    roomId: text("room_id").notNull().references(() => gameRooms.id, { onDelete: "cascade" }),
    participantId: text("participant_id").notNull().references(() => gameParticipants.id, { onDelete: "cascade" }),
    userId: text("user_id").notNull().references(() => users.id),
    word: text("word").notNull(),
    startRow: integer("start_row").notNull(),
    startCol: integer("start_col").notNull(),
    direction: gameDirectionEnum("direction").notNull(),
    length: integer("length").notNull(),
    foundAt: timestamp("found_at").notNull().defaultNow(),
    timeMs: integer("time_ms").notNull(),
  },
  (t) => [
    index("found_words_room_idx").on(t.roomId),
    index("found_words_participant_idx").on(t.participantId),
  ]
);

export const matchHistory = pgTable(
  "match_history",
  {
    id: text("id").primaryKey(),
    roomId: text("room_id").notNull().references(() => gameRooms.id),
    winnerId: text("winner_id").references(() => users.id),
    winnerTeamId: integer("winner_team_id"),
    totalWords: integer("total_words").notNull().default(0),
    durationSeconds: integer("duration_seconds").notNull(),
    playerCount: integer("player_count").notNull(),
    teamMode: boolean("team_mode").notNull().default(false),
    finalScores: jsonb("final_scores").$type<Record<string, number>>().notNull().default({}),
    playedAt: timestamp("played_at").notNull().defaultNow(),
  },
  (t) => [index("match_history_played_at_idx").on(t.playedAt)]
);

export const userStats = pgTable("user_stats", {
  userId: text("user_id").primaryKey().references(() => users.id, { onDelete: "cascade" }),
  gamesPlayed: integer("games_played").notNull().default(0),
  gamesWon: integer("games_won").notNull().default(0),
  totalWordsFound: integer("total_words_found").notNull().default(0),
  bestScore: integer("best_score").notNull().default(0),
  avgTimePerWordMs: integer("avg_time_per_word_ms").notNull().default(0),
  updatedAt: timestamp("updated_at").notNull().defaultNow(),
});

export type WordPlacement = {
  word: string;
  startRow: number;
  startCol: number;
  direction: "horizontal" | "vertical" | "diagonal_down" | "diagonal_up";
  length: number;
};

// ── Relations ───────────────────────────────────────────────────────────────

export const usersRelations = relations(users, ({ many, one }) => ({
  sessions: many(sessions),
  accounts: many(accounts),
  participants: many(gameParticipants),
  stats: one(userStats, { fields: [users.id], references: [userStats.userId] }),
}));

export const gameRoomsRelations = relations(gameRooms, ({ many, one }) => ({
  participants: many(gameParticipants),
  foundWords: many(foundWords),
  host: one(users, { fields: [gameRooms.hostId], references: [users.id] }),
}));

export const gameParticipantsRelations = relations(gameParticipants, ({ one, many }) => ({
  room: one(gameRooms, { fields: [gameParticipants.roomId], references: [gameRooms.id] }),
  user: one(users, { fields: [gameParticipants.userId], references: [users.id] }),
  foundWords: many(foundWords),
}));

export const foundWordsRelations = relations(foundWords, ({ one }) => ({
  room: one(gameRooms, { fields: [foundWords.roomId], references: [gameRooms.id] }),
  participant: one(gameParticipants, { fields: [foundWords.participantId], references: [gameParticipants.id] }),
}));
