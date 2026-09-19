import assert from "node:assert/strict";
import test from "node:test";
import { GAME_CONFIG } from "../game/config.ts";
import { createHighScorePersistence, type ScoreStorage } from "./highScore.ts";

function memoryStorage(initial: string | null = null): ScoreStorage {
  const values = new Map<string, string>();
  if (initial !== null) values.set(GAME_CONFIG.persistence.key, initial);
  return {
    getItem: (key) => values.get(key) ?? null,
    setItem: (key, value) => { values.set(key, value); },
  };
}

test("high scores survive a fresh persistence instance and cannot be lowered by another run", () => {
  const storage = memoryStorage();
  const first = createHighScorePersistence(() => storage);
  assert.equal(first.load(), 0);
  assert.equal(first.save(4200), 4200);
  const reloaded = createHighScorePersistence(() => storage);
  assert.equal(reloaded.load(), 4200);
  assert.equal(reloaded.save(10), 4200);
  storage.setItem(GAME_CONFIG.persistence.key, "9000");
  assert.equal(first.save(5000), 9000);
  assert.equal(storage.getItem(GAME_CONFIG.persistence.key), "9000");
});

test("missing, corrupt, negative, fractional, and unsafe stored values fall back safely", () => {
  for (const value of [null, "not-json", "{}", "[]", "null", '"400"', "-1", "1.5", "1e100"]) {
    const persistence = createHighScorePersistence(() => memoryStorage(value));
    assert.equal(persistence.load(), 0, `unexpected value for ${value}`);
  }
});

test("denied localStorage access retains a session-only high score", () => {
  const persistence = createHighScorePersistence(() => { throw new Error("SecurityError"); });
  assert.equal(persistence.load(), 0);
  assert.equal(persistence.save(750), 750);
  assert.equal(persistence.load(), 750);
  assert.equal(persistence.save(200), 750);
  assert.equal(persistence.save(NaN), 750);
});

test("quota and read failures do not interrupt scoring or discard a loaded record", () => {
  const storage = memoryStorage("1200");
  const persistence = createHighScorePersistence(() => storage);
  assert.equal(persistence.load(), 1200);
  storage.setItem = () => { throw new Error("QuotaExceededError"); };
  assert.equal(persistence.save(1600), 1600);
  storage.getItem = () => { throw new Error("SecurityError"); };
  assert.equal(persistence.load(), 1600);
  assert.equal(persistence.save(2000), 2000);
  const unavailable = createHighScorePersistence(() => null);
  assert.equal(unavailable.save(100), 100);
  assert.equal(unavailable.load(), 100);
});