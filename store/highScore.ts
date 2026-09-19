import { GAME_CONFIG } from "../game/config.ts";

export interface ScoreStorage {
  getItem: (key: string) => string | null;
  setItem: (key: string, value: string) => void;
}

function validScore(value: unknown): value is number {
  return typeof value === "number" && Number.isSafeInteger(value) && value >= 0;
}

export function createHighScorePersistence(accessStorage: () => ScoreStorage | null) {
  let memoryHighScore = 0;

  function load() {
    try {
      const raw = accessStorage()?.getItem(GAME_CONFIG.persistence.key);
      if (raw !== null && raw !== undefined) {
        const saved: unknown = JSON.parse(raw);
        if (validScore(saved)) memoryHighScore = Math.max(memoryHighScore, saved);
      }
    } catch {
      return memoryHighScore;
    }
    return memoryHighScore;
  }

  function save(score: number) {
    if (validScore(score)) memoryHighScore = Math.max(memoryHighScore, score);
    load();
    try {
      accessStorage()?.setItem(GAME_CONFIG.persistence.key, JSON.stringify(memoryHighScore));
    } catch {
      return memoryHighScore;
    }
    return memoryHighScore;
  }

  return { load, save };
}