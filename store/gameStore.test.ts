import assert from "node:assert/strict";
import test from "node:test";
import { GAME_CONFIG } from "../game/config.ts";
import { createGameStore, nextStatus, selectEffectiveQuality, selectReducedMotion, type FlightTelemetry } from "./gameStore.ts";

function readyStore() {
  const store = createGameStore();
  store.getState().setReady(true);
  return store;
}

function telemetry(distance: number): FlightTelemetry {
  return {
    elapsed: distance / GAME_CONFIG.speed.initial,
    distance,
    speed: GAME_CONFIG.speed.initial,
    density: GAME_CONFIG.spawn.density,
    surface: -1,
    flipping: false,
    flipCharge: 1,
  };
}

test("the store admits only valid menu, playing, paused, and gameOver transitions", () => {
  const store = createGameStore();
  const actions = store.getState();
  assert.equal(actions.startRun(), false);
  assert.equal(actions.pauseRun(), false);
  assert.equal(actions.resumeRun(), false);
  assert.equal(actions.finishRun(), false);
  actions.setReady(true);
  assert.equal(actions.startRun(), true);
  assert.equal(store.getState().status, "playing");
  assert.equal(actions.startRun(), false);
  assert.equal(actions.pauseRun(), true);
  assert.equal(store.getState().status, "paused");
  assert.equal(actions.startRun(), false);
  assert.equal(actions.finishRun(), false);
  assert.equal(actions.resumeRun(), true);
  assert.equal(actions.finishRun(), true);
  assert.equal(store.getState().status, "gameOver");
  assert.equal(actions.resumeRun(), false);
  assert.equal(actions.startRun(), true);
  assert.equal(store.getState().runId, 2);
  assert.equal(actions.returnToMenu(), true);
  assert.equal(store.getState().status, "menu");
  assert.equal(nextStatus("menu", "finish"), "menu");
});

test("score is distance plus banked orb bonuses with a capped consecutive-orb multiplier", () => {
  const store = readyStore();
  const actions = store.getState();
  actions.startRun();
  actions.syncTelemetry(telemetry(42.9));
  assert.equal(store.getState().score, 42);
  assert.equal(actions.collectOrb(), 100);
  assert.equal(actions.collectOrb(), 100);
  assert.equal(actions.collectOrb(), 200);
  assert.equal(store.getState().combo, 2);
  assert.equal(store.getState().score, 442);
  for (let index = 0; index < 30; index += 1) actions.collectOrb();
  assert.equal(store.getState().combo, GAME_CONFIG.scoring.maximumCombo);
  assert.equal(store.getState().score, store.getState().distanceScore + store.getState().orbBonus);
});

test("hits reset the combo without removing points, and lethal damage ends the run", () => {
  const store = readyStore();
  const actions = store.getState();
  actions.startRun();
  for (let index = 0; index < 3; index += 1) actions.collectOrb();
  const score = store.getState().score;
  actions.recordHit();
  assert.equal(store.getState().combo, 1);
  assert.equal(store.getState().orbStreak, 0);
  assert.equal(store.getState().score, score);
  assert.equal(store.getState().shield, 75);
  for (let index = 0; index < 3; index += 1) actions.recordHit();
  assert.equal(store.getState().status, "gameOver");
  assert.equal(actions.collectOrb(), 0);
  assert.equal(actions.recordHit(), false);
});

test("pause freezes score and difficulty, and stale or invalid telemetry cannot regress score", () => {
  const store = readyStore();
  const actions = store.getState();
  actions.startRun();
  actions.syncTelemetry(telemetry(50));
  actions.syncTelemetry(telemetry(10));
  assert.equal(store.getState().score, 50);
  actions.syncTelemetry(telemetry(NaN));
  assert.equal(store.getState().score, 50);
  actions.pauseRun();
  const paused = store.getState();
  actions.syncTelemetry(telemetry(100));
  assert.equal(actions.collectOrb(), 0);
  assert.equal(actions.recordHit(), false);
  assert.equal(store.getState(), paused);
});

test("restart and menu clear the run but preserve a safely hydrated high score", () => {
  const store = readyStore();
  const actions = store.getState();
  actions.hydrateHighScore(900);
  actions.hydrateHighScore(NaN);
  actions.hydrateHighScore(-10);
  actions.startRun();
  assert.equal(store.getState().bestAtStart, 900);
  actions.syncTelemetry(telemetry(1100));
  actions.finishRun();
  actions.startRun();
  assert.equal(store.getState().score, 0);
  assert.equal(store.getState().combo, 1);
  assert.equal(store.getState().highScore, 1100);
  assert.equal(store.getState().bestAtStart, 1100);
  actions.returnToMenu();
  assert.equal(store.getState().highScore, 1100);
});

test("settings clamp volumes, validate presets, and survive every run reset", () => {
  const store = readyStore();
  const actions = store.getState();
  actions.updateSettings({ quality: "low", masterVolume: -1, musicVolume: 2, effectsVolume: NaN });
  assert.deepEqual(store.getState().settings, {
    quality: "low", adaptiveQuality: true, masterVolume: 0, musicVolume: 1, effectsVolume: 0.85, muted: false, reducedMotion: null,
  });
  actions.setSystemReducedMotion(true);
  assert.equal(selectReducedMotion(store.getState()), true);
  actions.updateSettings({ reducedMotion: false });
  assert.equal(selectReducedMotion(store.getState()), false);
  actions.startRun();
  actions.finishRun();
  actions.startRun();
  actions.returnToMenu();
  assert.equal(store.getState().settings.quality, "low");
  actions.hydrateProfile({ settings: { quality: "toString", masterVolume: "loud", reducedMotion: "yes" } });
  assert.equal(store.getState().settings.quality, "low");
  assert.equal(store.getState().settings.masterVolume, 0);
});

test("settings and leaderboard panels block launching or resuming behind them", () => {
  const store = readyStore();
  const actions = store.getState();
  assert.equal(actions.openPanel("settings"), true);
  assert.equal(actions.startRun(), false);
  actions.closePanel();
  actions.startRun();
  assert.equal(actions.openPanel("leaderboard"), false);
  actions.pauseRun();
  actions.openPanel("leaderboard");
  assert.equal(actions.resumeRun(), false);
  actions.closePanel();
  assert.equal(actions.resumeRun(), true);
});

test("mute persists through resets and accepts only boolean profile values", () => {
  const store = readyStore();
  const actions = store.getState();
  actions.hydrateProfile({ settings: { musicVolume: 0.3 } });
  assert.equal(store.getState().settings.muted, false);
  actions.updateSettings({ muted: true });
  actions.startRun();
  actions.pauseRun();
  actions.returnToMenu();
  assert.equal(store.getState().settings.muted, true);
  actions.hydrateProfile({ settings: { muted: "false" } });
  assert.equal(store.getState().settings.muted, true);
  actions.hydrateProfile({ settings: { muted: false } });
  assert.equal(store.getState().settings.muted, false);
});

test("adaptive quality respects the selected ceiling and resets only on a manual quality change", () => {
  const store = readyStore();
  const actions = store.getState();
  assert.equal(actions.lowerQuality(), true);
  assert.equal(selectEffectiveQuality(store.getState()), "medium");
  assert.equal(store.getState().settings.quality, "high");
  actions.startRun();
  actions.returnToMenu();
  assert.equal(selectEffectiveQuality(store.getState()), "medium");
  actions.lowerQuality();
  assert.equal(selectEffectiveQuality(store.getState()), "low");
  assert.equal(actions.lowerQuality(), false);
  actions.updateSettings({ muted: true });
  assert.equal(selectEffectiveQuality(store.getState()), "low");
  actions.updateSettings({ quality: "medium" });
  assert.equal(selectEffectiveQuality(store.getState()), "medium");
  actions.lowerQuality();
  assert.equal(selectEffectiveQuality(store.getState()), "low");
  actions.updateSettings({ adaptiveQuality: false });
  assert.equal(selectEffectiveQuality(store.getState()), "medium");
  assert.equal(actions.lowerQuality(), false);
});

test("completed runs are recorded once, ranked, capped, and retained after instant restart", () => {
  const store = readyStore();
  const actions = store.getState();
  for (const distance of [70, 10, 60, 50, 20, 40, 30]) {
    actions.startRun();
    actions.syncTelemetry(telemetry(distance));
    assert.equal(actions.finishRun(), true);
    assert.equal(actions.finishRun(), false);
  }
  assert.deepEqual(store.getState().leaderboard.map((entry) => entry.score), [70, 60, 50, 40, 30]);
  actions.startRun();
  for (let index = 0; index < 3; index += 1) actions.collectOrb();
  for (let index = 0; index < 4; index += 1) actions.recordHit();
  assert.equal(store.getState().leaderboard[0].score, 400);
  assert.equal(store.getState().leaderboard[0].peakCombo, 2);
  actions.startRun();
  assert.equal(store.getState().score, 0);
  assert.equal(store.getState().leaderboard[0].score, 400);
});

test("profile hydration discards invalid records and keeps a recovered personal best", () => {
  const store = readyStore();
  const valid = { id: 1, score: 450, distance: 50, pickups: 3, peakCombo: 2 };
  store.getState().hydrateProfile({
    settings: { quality: "medium", masterVolume: 0.4 },
    leaderboard: [valid, valid, { ...valid, id: 2, score: -10 }, { ...valid, id: 3, distance: NaN }, null, {}],
  });
  assert.equal(store.getState().settings.quality, "medium");
  assert.equal(store.getState().leaderboard.length, 1);
  assert.equal(store.getState().highScore, 450);
  store.getState().hydrateProfile(null);
  assert.equal(store.getState().leaderboard.length, 1);
});