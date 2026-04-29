import type { WordPlacement } from "@/server/db/schema";

export type BotSpeed = "slow" | "medium" | "fast";

const BOT_DELAYS: Record<BotSpeed, { min: number; max: number }> = {
  slow:   { min: 25000, max: 40000 },
  medium: { min: 12000, max: 20000 },
  fast:   { min: 5000,  max: 10000 },
};

type BotOptions = {
  roomId: string;
  botUserId: string;
  wordList: WordPlacement[];
  foundWords: Set<string>;
  speed: BotSpeed;
  onWordFound: (placement: WordPlacement) => Promise<void>;
  onStop: () => void;
};

export class GameBot {
  private timer: ReturnType<typeof setTimeout> | null = null;
  private stopped = false;
  private remainingWords: WordPlacement[];
  private options: BotOptions;

  constructor(options: BotOptions) {
    this.options = options;
    this.remainingWords = [...options.wordList]
      .filter((w) => !options.foundWords.has(w.word))
      .sort(() => Math.random() - 0.5);
  }

  start() { this.scheduleNext(); }

  stop() {
    this.stopped = true;
    if (this.timer) { clearTimeout(this.timer); this.timer = null; }
    this.options.onStop();
  }

  private scheduleNext() {
    if (this.stopped || this.remainingWords.length === 0) return;
    const { min, max } = BOT_DELAYS[this.options.speed];
    const delay = min + Math.random() * (max - min);
    this.timer = setTimeout(async () => {
      if (this.stopped) return;
      const word = this.remainingWords.shift();
      if (!word) return;
      if (this.options.foundWords.has(word.word)) { this.scheduleNext(); return; }
      try { await this.options.onWordFound(word); } catch (err) { console.error("Bot error:", err); }
      this.scheduleNext();
    }, delay);
  }

  markWordFound(word: string) {
    this.remainingWords = this.remainingWords.filter((w) => w.word !== word);
  }
}

class BotManager {
  private bots = new Map<string, GameBot>();
  add(roomId: string, bot: GameBot) { this.bots.set(roomId, bot); }
  get(roomId: string): GameBot | undefined { return this.bots.get(roomId); }
  remove(roomId: string) {
    const bot = this.bots.get(roomId);
    if (bot) { bot.stop(); this.bots.delete(roomId); }
  }
  markWordFound(roomId: string, word: string) { this.bots.get(roomId)?.markWordFound(word); }
}

export const botManager = new BotManager();