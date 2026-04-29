export type ClientMessage =
  | { type: "join_room"; roomId: string; token: string }
  | { type: "leave_room"; roomId: string }
  | { type: "submit_word"; roomId: string; startRow: number; startCol: number; endRow: number; endCol: number }
  | { type: "ping" };

export type ServerMessage =
  | { type: "pong" }
  | { type: "error"; message: string }
  | { type: "room_joined"; roomId: string; playerId: string }
  | { type: "player_joined"; roomId: string; player: WsPlayer }
  | { type: "player_left"; roomId: string; userId: string }
  | { type: "player_team_changed"; roomId: string; userId: string; teamId: number; color: string }
  | { type: "game_started"; roomId: string; grid: string[][]; startedAt: string; durationSeconds: number; totalWordCount: number }
  | { type: "word_found"; roomId: string; word: WordFoundPayload }
  | { type: "game_finished"; roomId: string; results: GameResult[]; teamResults?: TeamResult[] }
  | { type: "room_state"; roomId: string; state: RoomState };

export type WsPlayer = {
  userId: string;
  name: string;
  color: string;
  score: number;
  playerIndex: number;
  teamId: number | null;
};

export type WordFoundPayload = {
  word: string;
  startRow: number;
  startCol: number;
  direction: string;
  length: number;
  participantId: string;
  userId: string;
  color: string;
  foundAt: string;
};

export type GameResult = {
  userId: string;
  name: string;
  color: string;
  score: number;
  teamId: number | null;
};

export type TeamResult = {
  teamId: number;
  color: string;
  score: number;
  players: string[];
};

export type RoomState = {
  status: "waiting" | "starting" | "active" | "finished";
  players: WsPlayer[];
  foundWords: WordFoundPayload[];
  grid: string[][] | null;
  startedAt: string | null;
  durationSeconds: number;
  teamMode?: boolean;
};