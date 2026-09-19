import assert from "node:assert/strict";
import test from "node:test";
import { DIFFICULTY_PRESETS, GAME_CONFIG, type DifficultyPreset } from "./config.ts";
import { difficultyAt, timeAtDistance } from "./difficulty.ts";
import {
  INITIAL_ROUTE,
  canReachCell,
  createChunk,
  createChunkPool,
  isCellSafe,
  recycleChunks,
  resetChunkPool,
  validateChunk,
  writeChunk,
  unlockHardPatterns,
} from "./patterns.ts";

test("9,216 seeded chunks have readable reachable routes at every preset's maximum speed", () => {
  const kinds = new Set<string>();
  let flips = 0;
  for (const preset of Object.keys(DIFFICULTY_PRESETS) as DifficultyPreset[]) {
  const tuning = DIFFICULTY_PRESETS[preset];
  for (let seed = 1; seed <= 64; seed += 1) {
    const chunk = createChunk(0);
    let entry = { ...INITIAL_ROUTE };
    for (let index = 0; index < 48; index += 1) {
      writeChunk(chunk, index, seed, entry, preset);
      assert.equal(chunk.fallback, false, `unexpected fallback: seed ${seed}, chunk ${index}`);
      assert.equal(validateChunk(chunk, entry).valid, true);
      let previous = entry;
      for (const row of chunk.rows) {
        assert.ok(isCellSafe(row, row.route.lane, row.route.surface));
        assert.ok(canReachCell(previous, row.route.lane, row.route.surface, row.index, tuning.maximumSpeed, tuning.rowSpacing));
        assert.ok(Math.abs(row.route.lane - previous.lane) <= GAME_CONFIG.fairness.maximumLaneSteps);
        assert.ok(row.obstacles.filter((slot) => slot.active && slot.kind === "barrier").length <= 1);
        if (row.obstacles.some((slot) => slot.active && slot.kind === "laser")) {
          assert.equal(row.route.lane, previous.lane);
          assert.equal(row.obstacles.filter((slot) => slot.active && slot.surface === row.route.surface).length, 0);
        }
        if (row.route.surface !== previous.surface) flips += 1;
        for (const obstacle of row.obstacles) if (obstacle.active) kinds.add(obstacle.kind);
        previous = row.route;
      }
      entry = { ...previous };
    }
  }
  }
  assert.deepEqual([...kinds].sort(), ["barrier", "block", "laser"]);
  assert.ok(flips >= 3072);
});

test("the validator rejects a fully obstructed row", () => {
  const chunk = createChunk(0);
  writeChunk(chunk, 0, 42, INITIAL_ROUTE);
  for (const obstacle of chunk.rows[0].obstacles) {
    obstacle.active = true;
    obstacle.kind = "block";
  }
  assert.equal(validateChunk(chunk, INITIAL_ROUTE).valid, false);
});

test("moving barriers reserve their whole sweep, including adjacent lanes", () => {
  const row = createChunk(0).rows[0];
  row.obstacles[1].kind = "barrier";
  row.obstacles[1].active = true;
  assert.equal(isCellSafe(row, 0, -1), false);
  assert.equal(isCellSafe(row, 2, -1), false);
  assert.equal(isCellSafe(row, 1, 1), true);
});

test("paths cannot demand consecutive flips or simultaneous two-lane jumps", () => {
  const previous = { lane: 0, surface: -1 as const, rowIndex: 4, lastFlipRow: 4 };
  assert.equal(canReachCell(previous, 0, 1, 5), false);
  assert.equal(canReachCell(previous, 0, 1, 6), true);
  assert.equal(canReachCell({ ...previous, lastFlipRow: -100 }, 2, 1, 5), false);
});

test("recycling and restarting mutate the fixed pool without replacing slots", () => {
  const pool = createChunkPool();
  const chunks = [...pool.chunks];
  const obstacles = [...pool.obstacles];
  const orbs = [...pool.orbs];
  const oldGeneration = pool.obstacles[0].generation;
  const distance = pool.chunks[0].rows.at(-1)!.orb.distance + GAME_CONFIG.spawn.recycleBehind + 1;
  recycleChunks(pool, distance);
  assert.equal(pool.chunks[0].index, GAME_CONFIG.spawn.chunkCount);
  assert.ok(pool.obstacles[0].generation > oldGeneration);
  resetChunkPool(pool);
  assert.equal(pool.nextIndex, GAME_CONFIG.spawn.chunkCount);
  chunks.forEach((chunk, index) => assert.equal(pool.chunks[index], chunk));
  obstacles.forEach((obstacle, index) => assert.equal(pool.obstacles[index], obstacle));
  orbs.forEach((orb, index) => assert.equal(pool.orbs[index], orb));
});

test("spawn density follows arrival time smoothly across every chunk boundary", () => {
  const chunk = createChunk(0);
  let entry = { ...INITIAL_ROUTE };
  let previousDensity = GAME_CONFIG.spawn.density as number;
  let previousTime = 0;
  let earlyObstacles = 0;
  let lateObstacles = 0;
  for (let index = 0; index < 80; index += 1) {
    writeChunk(chunk, index, GAME_CONFIG.seed, entry);
    assert.ok(validateChunk(chunk, entry).valid);
    for (const row of chunk.rows) {
      assert.equal(row.density, difficultyAt(timeAtDistance(row.orb.distance)).density);
      assert.ok(row.density >= previousDensity);
      const arrival = timeAtDistance(row.orb.distance);
      const tuning = DIFFICULTY_PRESETS.normal;
      const maximumRate = Math.max(1.5 * (tuning.cruiseDensity - tuning.initialDensity) / GAME_CONFIG.onboarding.seconds,
        (tuning.maximumDensity - tuning.cruiseDensity) / tuning.timeConstant);
      assert.ok(row.density - previousDensity <= maximumRate * (arrival - previousTime) + 1e-10);
      previousTime = arrival;
      previousDensity = row.density;
      const occupied = row.obstacles.filter((slot) => slot.active).length;
      if (index < 10) earlyObstacles += occupied;
      if (index >= 70) lateObstacles += occupied;
    }
    entry = { ...chunk.rows.at(-1)!.route };
  }
  assert.ok(lateObstacles > earlyObstacles);
});

test("every preset offers its first flip within five seconds and remains gentle until a completed flip", () => {
  for (const preset of Object.keys(DIFFICULTY_PRESETS) as DifficultyPreset[]) {
    const pool = createChunkPool(42, preset);
    const first = pool.chunks[0].rows[0];
    assert.equal(first.orb.surface, 1);
    assert.ok(timeAtDistance(first.orb.distance, preset) <= 5);
    assert.equal(first.obstacles.filter((slot) => slot.active).length, 1);
    assert.equal(isCellSafe(first, 0, -1), true);
    assert.equal(isCellSafe(first, 2, -1), true);
    for (let distance = 0; distance < 4000; distance += 100) {
      recycleChunks(pool, distance);
      assert.ok(pool.obstacles.every((slot) => !slot.active || slot.kind === "block"));
    }
  }
});

test("the first completed flip unlocks only unseen chunks and never hardens the first 20 seconds", () => {
  const pool = createChunkPool();
  const visible = pool.obstacles.filter((slot) => slot.distance <= 80 + GAME_CONFIG.spawn.visibleDistance);
  const before = JSON.stringify(visible);
  unlockHardPatterns(pool, 80);
  assert.equal(JSON.stringify(visible), before);
  assert.equal(pool.hasFlipped, true);
  assert.ok(pool.obstacles.some((slot) => slot.active && slot.kind === "laser"));
  assert.ok(pool.obstacles.every((slot) => timeAtDistance(slot.distance) >= GAME_CONFIG.onboarding.seconds || !slot.active || slot.kind === "block"));
  resetChunkPool(pool);
  assert.equal(pool.hasFlipped, false);
});