import { DIFFICULTY_PRESETS, GAME_CONFIG, type DifficultyPreset, type ObstacleKind, type Surface } from "./config.ts";
import { difficultyAt, distanceAtTime, timeAtDistance } from "./difficulty.ts";

export interface RouteState {
  lane: number;
  surface: Surface;
  rowIndex: number;
  lastFlipRow: number;
}

export interface ObstacleSlot {
  id: number;
  generation: number;
  kind: ObstacleKind;
  chunkIndex: number;
  frequency: number;
  lane: number;
  surface: Surface;
  distance: number;
  phase: number;
  active: boolean;
  spent: boolean;
  nearMissGap: number;
  nearMissEligible: boolean;
  nearMissChecked: boolean;
}

export interface OrbSlot {
  id: number;
  generation: number;
  lane: number;
  surface: Surface;
  distance: number;
  active: boolean;
  collected: boolean;
}

export interface PatternRow {
  index: number;
  density: number;
  obstacles: ObstacleSlot[];
  orb: OrbSlot;
  route: RouteState;
}

export interface Chunk {
  slot: number;
  index: number;
  difficulty: DifficultyPreset;
  rows: PatternRow[];
  fallback: boolean;
}

export interface ChunkPool {
  chunks: Chunk[];
  obstacles: ObstacleSlot[];
  orbs: OrbSlot[];
  exit: RouteState;
  nextIndex: number;
  recycleCursor: number;
  seed: number;
  difficulty: DifficultyPreset;
  hasFlipped: boolean;
}

export const INITIAL_ROUTE: RouteState = {
  lane: 1,
  surface: -1,
  rowIndex: -1,
  lastFlipRow: -100,
};

const surfaces: Surface[] = [-1, 1];

function randomSource(seed: number) {
  let state = seed | 0;
  return () => {
    state = (state + 0x6d2b79f5) | 0;
    let value = Math.imul(state ^ (state >>> 15), 1 | state);
    value ^= value + Math.imul(value ^ (value >>> 7), 61 | value);
    return ((value ^ (value >>> 14)) >>> 0) / 4294967296;
  };
}

export function isCellSafe(row: PatternRow, lane: number, surface: Surface) {
  const position = GAME_CONFIG.flight.lanes[lane];
  return row.obstacles.every((obstacle) => {
    if (!obstacle.active || obstacle.surface !== surface) return true;
    const sweep = obstacle.kind === "barrier" ? GAME_CONFIG.obstacles.barrierTravel : 0;
    const occupiedRadius =
      GAME_CONFIG.obstacles[obstacle.kind].x +
      sweep +
      GAME_CONFIG.flight.playerHalfExtents.x +
      GAME_CONFIG.fairness.clearance;
    return Math.abs(GAME_CONFIG.flight.lanes[obstacle.lane] - position) > occupiedRadius;
  });
}

export function canReachCell(
  previous: RouteState,
  lane: number,
  surface: Surface,
  rowIndex: number,
  maximumSpeed: number = GAME_CONFIG.speed.maximum,
  rowSpacing: number = GAME_CONFIG.spawn.rowSpacing,
) {
  const laneSteps = Math.abs(previous.lane - lane);
  const flips = previous.surface !== surface;
  if (!flips && laneSteps === 0) return true;

  const rowTravel = (rowIndex - previous.rowIndex) * rowSpacing;
  const clearance =
    2 *
    (Math.max(...Object.values(GAME_CONFIG.obstacles).flatMap((value) =>
      typeof value === "object" ? [value.z] : [],
    )) +
      GAME_CONFIG.flight.playerHalfExtents.z +
      GAME_CONFIG.flip.forwardArc +
      GAME_CONFIG.fairness.clearance);
  const availableSeconds = (rowTravel - clearance) / maximumSpeed;
  const movementSeconds =
    laneSteps * GAME_CONFIG.flight.laneChangeSeconds +
    (flips ? GAME_CONFIG.flip.duration : 0) +
    GAME_CONFIG.fairness.reactionSeconds;

  if (movementSeconds > availableSeconds) return false;

  // Reserve lateral travel on both sides of a flip; a path never relies on invulnerability.
  const cooldownBudget =
    GAME_CONFIG.flip.cooldown + 2 * GAME_CONFIG.flight.laneChangeSeconds;
  const sinceLastFlip =
    ((rowIndex - previous.lastFlipRow) * rowSpacing) / maximumSpeed;
  return !flips || sinceLastFlip >= cooldownBudget;
}

export function validateChunk(
  chunk: Chunk,
  entry: RouteState,
  maximumSpeed: number = DIFFICULTY_PRESETS[chunk.difficulty].maximumSpeed,
): { valid: boolean; path: RouteState[] } {
  let frontier: { state: RouteState; path: RouteState[] }[] = [{ state: entry, path: [] }];

  for (const row of chunk.rows) {
    const next = new Map<string, { state: RouteState; path: RouteState[] }>();
    for (const candidate of frontier) {
      for (const surface of surfaces) {
        for (let lane = 0; lane < GAME_CONFIG.flight.lanes.length; lane += 1) {
          if (!isCellSafe(row, lane, surface)) continue;
          if (!canReachCell(candidate.state, lane, surface, row.index, maximumSpeed, DIFFICULTY_PRESETS[chunk.difficulty].rowSpacing)) continue;
          const state: RouteState = {
            lane,
            surface,
            rowIndex: row.index,
            lastFlipRow: candidate.state.surface !== surface ? row.index : candidate.state.lastFlipRow,
          };
          const key = `${lane}:${surface}`;
          const existing = next.get(key);
          if (existing && existing.state.lastFlipRow <= state.lastFlipRow) continue;
          next.set(key, { state, path: [...candidate.path, state] });
        }
      }
    }
    if (next.size === 0) return { valid: false, path: [] };
    frontier = [...next.values()];
  }

  return { valid: true, path: frontier[0].path };
}

export function createChunk(slot: number): Chunk {
  return {
    slot,
    index: -1,
    difficulty: "normal",
    fallback: false,
    rows: Array.from({ length: GAME_CONFIG.spawn.rowsPerChunk }, (_, rowSlot) => {
      const rowId = slot * GAME_CONFIG.spawn.rowsPerChunk + rowSlot;
      return {
        index: -1,
        density: GAME_CONFIG.spawn.density,
        route: { ...INITIAL_ROUTE },
        obstacles: Array.from({ length: GAME_CONFIG.spawn.cellsPerRow }, (_, cell) => ({
          id: rowId * GAME_CONFIG.spawn.cellsPerRow + cell,
          generation: 0,
          kind: "block" as const,
          chunkIndex: -1,
          frequency: DIFFICULTY_PRESETS.normal.barrierFrequency,
          lane: cell % 3,
          surface: (cell < 3 ? -1 : 1) as Surface,
          distance: 0,
          phase: 0,
          active: false,
          spent: false,
          nearMissGap: Infinity,
          nearMissEligible: true,
          nearMissChecked: false,
        })),
        orb: {
          id: rowId,
          generation: 0,
          lane: 1,
          surface: -1 as const,
          distance: 0,
          active: true,
          collected: false,
        },
      };
    }),
  };
}

export function writeChunk(chunk: Chunk, index: number, seed: number, entry: RouteState, preset: DifficultyPreset = "normal", hasFlipped = true) {
  const random = randomSource(seed ^ Math.imul(index + 1, 0x9e3779b1));
  const tuning = DIFFICULTY_PRESETS[preset];
  let previous = entry;
  chunk.index = index;
  chunk.difficulty = preset;
  chunk.fallback = false;

  for (let rowSlot = 0; rowSlot < chunk.rows.length; rowSlot += 1) {
    const row = chunk.rows[rowSlot];
    row.index = index * GAME_CONFIG.spawn.rowsPerChunk + rowSlot;
    const distance = distanceAtTime(GAME_CONFIG.onboarding.firstFlipAt, preset) + row.index * tuning.rowSpacing;
    const arrival = timeAtDistance(distance, preset);
    const hard = hasFlipped && arrival >= GAME_CONFIG.onboarding.seconds;
    const gateRow = hard && row.index % tuning.gateEvery === tuning.gateEvery - 1;
    const barrierRow = hard && row.index % tuning.gateEvery === tuning.gateEvery - 3;
    const recoveryRow = hard && row.index % tuning.gateEvery === 0;
    const desiredSurface = (row.index === 0 ? 1 : gateRow ? -previous.surface : previous.surface) as Surface;
    const candidates = GAME_CONFIG.flight.lanes
      .map((_, lane) => lane)
      .filter((lane) => Math.abs(lane - previous.lane) <= GAME_CONFIG.fairness.maximumLaneSteps
        && (!(gateRow || recoveryRow || !hard) || lane === previous.lane)
        && canReachCell(previous, lane, desiredSurface, row.index, tuning.maximumSpeed, tuning.rowSpacing));
    const surface = candidates.length > 0 ? desiredSurface : previous.surface;
    const lane = candidates.length > 0
      ? candidates[Math.floor(random() * candidates.length)]
      : previous.lane;

    Object.assign(row.route, {
      lane,
      surface,
      rowIndex: row.index,
      lastFlipRow: surface !== previous.surface ? row.index : previous.lastFlipRow,
    });

    row.density = difficultyAt(arrival, preset).density;
    const barrierLane = random() < 0.5 ? 0 : 2;
    for (const obstacle of row.obstacles) {
      obstacle.generation += 1;
      obstacle.chunkIndex = index;
      obstacle.distance = distance;
      obstacle.phase = random() * Math.PI * 2;
      obstacle.frequency = tuning.barrierFrequency;
      obstacle.spent = false;
      obstacle.nearMissGap = Infinity;
      obstacle.nearMissEligible = true;
      obstacle.nearMissChecked = false;
      obstacle.kind = gateRow ? "laser" : barrierRow ? "barrier" : "block";
      if (!hard) {
        obstacle.active = row.index % GAME_CONFIG.onboarding.easyBlockEvery === 0
          && obstacle.surface === -1 && obstacle.lane === 1;
      } else if (gateRow) obstacle.active = obstacle.surface !== surface;
      else if (barrierRow) obstacle.active = obstacle.surface !== surface && obstacle.lane === barrierLane;
      else if (recoveryRow) obstacle.active = obstacle.surface !== surface && obstacle.lane === previous.lane;
      else obstacle.active = random() < row.density;
      if (obstacle.surface === surface && obstacle.lane === lane) obstacle.active = false;
    }

    Object.assign(row.orb, {
      generation: row.orb.generation + 1,
      lane,
      surface,
      distance,
      active: true,
      collected: false,
    });
    previous = row.route;
  }

  if (!validateChunk(chunk, entry).valid) {
    chunk.fallback = true;
    for (const row of chunk.rows) {
      for (const obstacle of row.obstacles) obstacle.active = false;
      Object.assign(row.route, entry, { rowIndex: row.index });
      Object.assign(row.orb, { lane: entry.lane, surface: entry.surface });
    }
  }

  return chunk.rows[chunk.rows.length - 1].route;
}

export function createChunkPool(seed: number = GAME_CONFIG.seed, difficulty: DifficultyPreset = "normal"): ChunkPool {
  const chunks = Array.from({ length: GAME_CONFIG.spawn.chunkCount }, (_, slot) => createChunk(slot));
  const pool: ChunkPool = {
    chunks,
    obstacles: chunks.flatMap((chunk) => chunk.rows.flatMap((row) => row.obstacles)),
    orbs: chunks.flatMap((chunk) => chunk.rows.map((row) => row.orb)),
    exit: { ...INITIAL_ROUTE },
    nextIndex: 0,
    recycleCursor: 0,
    seed,
    difficulty,
    hasFlipped: false,
  };
  resetChunkPool(pool, seed);
  return pool;
}

export function resetChunkPool(pool: ChunkPool, seed: number = pool.seed, difficulty: DifficultyPreset = pool.difficulty) {
  pool.seed = seed;
  pool.difficulty = difficulty;
  pool.hasFlipped = false;
  pool.nextIndex = 0;
  pool.recycleCursor = 0;
  Object.assign(pool.exit, INITIAL_ROUTE);
  for (const chunk of pool.chunks) {
    const exit = writeChunk(chunk, pool.nextIndex++, pool.seed, pool.exit, pool.difficulty, pool.hasFlipped);
    Object.assign(pool.exit, exit);
  }
}

export function unlockHardPatterns(pool: ChunkPool, distance: number) {
  if (pool.hasFlipped) return;
  pool.hasFlipped = true;
  let entry = INITIAL_ROUTE;
  for (const chunk of [...pool.chunks].sort((first, second) => first.index - second.index)) {
    if (chunk.rows[0].orb.distance > distance + GAME_CONFIG.spawn.visibleDistance) {
      writeChunk(chunk, chunk.index, pool.seed, entry, pool.difficulty, true);
    }
    entry = chunk.rows[chunk.rows.length - 1].route;
  }
  Object.assign(pool.exit, entry);
}

export function recycleChunks(pool: ChunkPool, distance: number) {
  for (let attempts = 0; attempts < pool.chunks.length; attempts += 1) {
    const chunk = pool.chunks[pool.recycleCursor];
    const lastDistance = chunk.rows[chunk.rows.length - 1].orb.distance;
    if (lastDistance - distance >= -GAME_CONFIG.spawn.recycleBehind) break;
    const exit = writeChunk(chunk, pool.nextIndex++, pool.seed, pool.exit, pool.difficulty, pool.hasFlipped);
    Object.assign(pool.exit, exit);
    pool.recycleCursor = (pool.recycleCursor + 1) % pool.chunks.length;
  }
}

export function obstacleX(obstacle: ObstacleSlot, time: number) {
  return GAME_CONFIG.flight.lanes[obstacle.lane] +
    (obstacle.kind === "barrier"
      ? Math.sin(time * obstacle.frequency + obstacle.phase) *
        GAME_CONFIG.obstacles.barrierTravel
      : 0);
}