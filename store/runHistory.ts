import { DIFFICULTY_PRESETS, GAME_CONFIG, type DifficultyPreset, type ObstacleKind } from "../game/config.ts";

export interface DeathDetails {
  obstacle: ObstacleKind;
  chunkIndex: number;
  position: { x: number; y: number; z: number };
  distance: number;
}

export type RunEnding = "death" | "finished" | "abandoned" | "interrupted";

export interface PlaytestRun {
  id: string;
  endedAt: number;
  duration: number;
  simulationTime: number;
  difficulty: DifficultyPreset;
  score: number;
  maxCombo: number;
  orbs: number;
  flips: number;
  nearMisses: number;
  ending: RunEnding;
  death: DeathDetails | null;
}

interface RunSnapshot {
  runKey: string;
  runDifficulty: DifficultyPreset;
  elapsed: number;
  aliveTime: number;
  score: number;
  peakCombo: number;
  pickups: number;
  flips: number;
  nearMisses: number;
}

export function snapshotRun(state: RunSnapshot, ending: RunEnding, death: DeathDetails | null = null): PlaytestRun {
  return {
    id: state.runKey, endedAt: Date.now(), duration: state.aliveTime, simulationTime: state.elapsed, difficulty: state.runDifficulty, score: state.score,
    maxCombo: state.peakCombo, orbs: state.pickups, flips: state.flips, ending,
    nearMisses: state.nearMisses,
    death: death ? { ...death, position: { ...death.position } } : null,
  };
}

function validDeath(value: unknown): value is DeathDetails {
  if (!value || typeof value !== "object") return false;
  const death = value as DeathDetails;
  return ["block", "barrier", "laser"].includes(death.obstacle)
    && Number.isSafeInteger(death.chunkIndex) && death.chunkIndex >= 0
    && Number.isFinite(death.distance) && death.distance >= 0
    && !!death.position && [death.position.x, death.position.y, death.position.z].every(Number.isFinite);
}

export function validateRuns(value: unknown): PlaytestRun[] {
  if (!Array.isArray(value)) return [];
  const runs = new Map<string, PlaytestRun>();
  for (const entry of value) {
    if (!entry || typeof entry !== "object") continue;
    const { id, endedAt, duration, score, maxCombo, orbs, flips, ending, death } = entry;
    const difficulty = entry.difficulty ?? "normal";
    const simulationTime = entry.simulationTime ?? duration;
    const nearMisses = entry.nearMisses ?? 0;
    if (typeof id !== "string" || !id || id.length > 100 || !Number.isSafeInteger(endedAt) || endedAt < 0
      || !Number.isFinite(duration) || duration < 0
      || !Number.isFinite(simulationTime) || simulationTime < 0
      || ![score, maxCombo, orbs, flips, nearMisses].every(Number.isSafeInteger)
      || score < 0 || orbs < 0 || flips < 0 || maxCombo < 1 || maxCombo > GAME_CONFIG.scoring.maximumCombo
      || !["death", "finished", "abandoned", "interrupted"].includes(ending)
      || nearMisses < 0 || typeof difficulty !== "string" || !Object.hasOwn(DIFFICULTY_PRESETS, difficulty)
      || (death !== null && !validDeath(death))) continue;
    runs.set(id, {
      id, endedAt, duration, simulationTime, difficulty: difficulty as DifficultyPreset, score, maxCombo, orbs, flips, nearMisses, ending,
      death: death ? { obstacle: death.obstacle, chunkIndex: death.chunkIndex, distance: death.distance,
        position: { x: death.position.x, y: death.position.y, z: death.position.z } } : null,
    });
  }
  return [...runs.values()].sort((first, second) => first.endedAt - second.endedAt).slice(-GAME_CONFIG.playtest.maximumRuns);
}

export function summarizeRuns(runs: readonly PlaytestRun[]) {
  const deaths = runs.filter((run) => run.ending === "death");
  const causes = (["block", "barrier", "laser", "unknown"] as const).map((obstacle) => ({
    obstacle, count: deaths.filter((run) => (run.death?.obstacle ?? "unknown") === obstacle).length,
  })).sort((first, second) => second.count - first.count);
  const windows = GAME_CONFIG.playtest.timeBuckets.map((start, index, buckets) => {
    const end = buckets[index + 1] ?? Infinity;
    return { start, end, count: deaths.filter((run) => run.duration >= start && run.duration < end).length };
  });
  return {
    total: runs.length, deaths: deaths.length,
    averageSurvival: deaths.length ? deaths.reduce((total, run) => total + run.duration, 0) / deaths.length : null,
    causes, windows,
  };
}

export function feedbackHref(run: PlaytestRun | undefined) {
  const body = ["Feedback:", "", "", "Last run:", run ? JSON.stringify(run, null, 2) : "No completed run yet."].join("\n");
  return `mailto:${encodeURIComponent(GAME_CONFIG.playtest.feedbackEmail)}?subject=${encodeURIComponent("NEON DRIFT playtest feedback")}&body=${encodeURIComponent(body)}`;
}