import { GAME_CONFIG } from "./config.ts";

export function difficultyAt(elapsed: number) {
  const time = Number.isFinite(elapsed) ? Math.max(0, elapsed) : 0;
  const progress = -Math.expm1(-time / GAME_CONFIG.difficulty.timeConstant);
  return {
    speed: GAME_CONFIG.speed.initial + (GAME_CONFIG.speed.maximum - GAME_CONFIG.speed.initial) * progress,
    density: GAME_CONFIG.spawn.density + (GAME_CONFIG.spawn.maximumDensity - GAME_CONFIG.spawn.density) * progress,
  };
}

export function distanceAtTime(elapsed: number) {
  const time = Number.isFinite(elapsed) ? Math.max(0, elapsed) : 0;
  const progress = -Math.expm1(-time / GAME_CONFIG.difficulty.timeConstant);
  return GAME_CONFIG.speed.maximum * time -
    (GAME_CONFIG.speed.maximum - GAME_CONFIG.speed.initial) * GAME_CONFIG.difficulty.timeConstant * progress;
}

export function timeAtDistance(distance: number) {
  if (!Number.isFinite(distance) || distance <= 0) return 0;
  let lower = distance / GAME_CONFIG.speed.maximum;
  let upper = distance / GAME_CONFIG.speed.initial;
  for (let iteration = 0; iteration < 32; iteration += 1) {
    const midpoint = (lower + upper) / 2;
    if (distanceAtTime(midpoint) < distance) lower = midpoint;
    else upper = midpoint;
  }
  return (lower + upper) / 2;
}