import assert from "node:assert/strict";
import test from "node:test";
import { GAME_CONFIG } from "./config.ts";
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
} from "./patterns.ts";

test("3,072 seeded chunks have a reachable route across every boundary at maximum speed", () => {
  const kinds = new Set<string>();
  let flips = 0;
  for (let seed = 1; seed <= 64; seed += 1) {
    const chunk = createChunk(0);
    let entry = { ...INITIAL_ROUTE };
    for (let index = 0; index < 48; index += 1) {
      writeChunk(chunk, index, seed, entry);
      assert.equal(chunk.fallback, false, `unexpected fallback: seed ${seed}, chunk ${index}`);
      assert.equal(validateChunk(chunk, entry).valid, true);
      let previous = entry;
      for (const row of chunk.rows) {
        assert.ok(isCellSafe(row, row.route.lane, row.route.surface));
        assert.ok(canReachCell(previous, row.route.lane, row.route.surface, row.index));
        if (row.route.surface !== previous.surface) flips += 1;
        for (const obstacle of row.obstacles) if (obstacle.active) kinds.add(obstacle.kind);
        previous = row.route;
      }
      entry = { ...previous };
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