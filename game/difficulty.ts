import { DIFFICULTY_PRESETS, GAME_CONFIG, type DifficultyPreset } from "./config.ts";

export function difficultyAt(elapsed: number, preset: DifficultyPreset = "normal") {
  const time = Number.isFinite(elapsed) ? Math.max(0, elapsed) : 0;
  const tuning = DIFFICULTY_PRESETS[preset];
  const intro = Math.min(1, time / GAME_CONFIG.onboarding.seconds);
  const eased = intro * intro * (3 - 2 * intro);
  const afterIntro = -Math.expm1(-Math.max(0, time - GAME_CONFIG.onboarding.seconds) / tuning.timeConstant);
  const speed = time <= GAME_CONFIG.onboarding.seconds
    ? tuning.initialSpeed + (tuning.cruiseSpeed - tuning.initialSpeed) * eased
    : tuning.cruiseSpeed + (tuning.maximumSpeed - tuning.cruiseSpeed) * afterIntro;
  return {
    speed,
    progress: (speed - tuning.initialSpeed) / (tuning.maximumSpeed - tuning.initialSpeed),
    density: time <= GAME_CONFIG.onboarding.seconds
      ? tuning.initialDensity + (tuning.cruiseDensity - tuning.initialDensity) * eased
      : tuning.cruiseDensity + (tuning.maximumDensity - tuning.cruiseDensity) * afterIntro,
  };
}

export function distanceAtTime(elapsed: number, preset: DifficultyPreset = "normal") {
  const time = Number.isFinite(elapsed) ? Math.max(0, elapsed) : 0;
  const tuning = DIFFICULTY_PRESETS[preset];
  const introSeconds = Math.min(time, GAME_CONFIG.onboarding.seconds);
  const intro = introSeconds / GAME_CONFIG.onboarding.seconds;
  const introDistance = tuning.initialSpeed * introSeconds + (tuning.cruiseSpeed - tuning.initialSpeed)
    * GAME_CONFIG.onboarding.seconds * (intro ** 3 - intro ** 4 / 2);
  const afterIntro = Math.max(0, time - GAME_CONFIG.onboarding.seconds);
  return introDistance + tuning.maximumSpeed * afterIntro - (tuning.maximumSpeed - tuning.cruiseSpeed)
    * tuning.timeConstant * -Math.expm1(-afterIntro / tuning.timeConstant);
}

export function timeAtDistance(distance: number, preset: DifficultyPreset = "normal") {
  if (!Number.isFinite(distance) || distance <= 0) return 0;
  const tuning = DIFFICULTY_PRESETS[preset];
  let lower = distance / tuning.maximumSpeed;
  let upper = distance / tuning.initialSpeed;
  for (let iteration = 0; iteration < 32; iteration += 1) {
    const midpoint = (lower + upper) / 2;
    if (distanceAtTime(midpoint, preset) < distance) lower = midpoint;
    else upper = midpoint;
  }
  return (lower + upper) / 2;
}