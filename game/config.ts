export const GAME_CONFIG = {
  seed: 271828,
  speed: { initial: 22, maximum: 40 },
  difficulty: { timeConstant: 90 },
  scoring: { pointsPerMeter: 1, orbBonus: 100, orbsPerCombo: 3, maximumCombo: 5 },
  persistence: { key: "neon-drift.high-score.v1", profileKey: "neon-drift.profile.v1", saveInterval: 1000 },
  flight: {
    lanes: [-3.2, 0, 3.2],
    surfaceHeight: 2.65,
    laneChangeSeconds: 0.22,
    playerHalfExtents: { x: 0.38, y: 0.26, z: 0.65 },
  },
  flip: { duration: 0.3, cooldown: 0.72, forwardArc: 0.9 },
  spawn: {
    chunkCount: 6,
    rowsPerChunk: 4,
    cellsPerRow: 6,
    rowSpacing: 32,
    firstRowDistance: 72,
    recycleBehind: 14,
    visibleDistance: 190,
    density: 0.38,
    maximumDensity: 0.86,
  },
  obstacles: {
    block: { x: 1.16, y: 0.95, z: 0.85 },
    barrier: { x: 0.7, y: 1.25, z: 0.7 },
    laser: { x: 1.6, y: 1.15, z: 0.22 },
    barrierTravel: 2.15,
    barrierFrequency: 1.6,
  },
  fairness: { clearance: 0.2, reactionSeconds: 0.14 },
  shield: { maximum: 100, hitDamage: 25, recoverySeconds: 1.15 },
  orbs: { radius: 0.46, energy: 10 },
  physics: { step: 1 / 60, maximumFrameDelta: 0.1 },
  effects: {
    hitSeconds: 0.45,
    shakeStrength: 0.16,
    particleCount: 72,
    particleSeconds: 0.65,
    trailInterval: 0.035,
  },
  camera: { fov: 64, maximumFov: 76, distance: 11.5, mobileFov: 78, mobileDistance: 14.5 },
  input: { swipeThreshold: 28, swipeMaximumSeconds: 0.7 },
} as const;

export type Surface = -1 | 1;
export type ObstacleKind = "block" | "barrier" | "laser";

export const QUALITY_PRESETS = {
  low: { particles: 16, speedLines: 0, dpr: 1, bloom: 0, bloomLevels: 0 },
  medium: { particles: 40, speedLines: 20, dpr: 1.25, bloom: 0.7, bloomLevels: 3 },
  high: { particles: 72, speedLines: 36, dpr: 1.5, bloom: 1.05, bloomLevels: 5 },
} as const;

export type QualityPreset = keyof typeof QUALITY_PRESETS;

export const OBSTACLE_CAPACITY =
  GAME_CONFIG.spawn.chunkCount *
  GAME_CONFIG.spawn.rowsPerChunk *
  GAME_CONFIG.spawn.cellsPerRow;

export const ORB_CAPACITY =
  GAME_CONFIG.spawn.chunkCount * GAME_CONFIG.spawn.rowsPerChunk;