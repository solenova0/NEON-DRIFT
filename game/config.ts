export const DIFFICULTY_PRESETS = {
  chill: { initialSpeed: 14, cruiseSpeed: 20, maximumSpeed: 32, initialDensity: 0.12, cruiseDensity: 0.28, maximumDensity: 0.62, timeConstant: 75, rowSpacing: 40, gateEvery: 6, barrierFrequency: 1 },
  normal: { initialSpeed: 16, cruiseSpeed: 24, maximumSpeed: 40, initialDensity: 0.16, cruiseDensity: 0.4, maximumDensity: 0.82, timeConstant: 45, rowSpacing: 36, gateEvery: 5, barrierFrequency: 1.2 },
  intense: { initialSpeed: 19, cruiseSpeed: 28, maximumSpeed: 46, initialDensity: 0.22, cruiseDensity: 0.52, maximumDensity: 0.9, timeConstant: 30, rowSpacing: 34, gateEvery: 4, barrierFrequency: 1.4 },
} as const;

export type DifficultyPreset = keyof typeof DIFFICULTY_PRESETS;

export const GAME_CONFIG = {
  seed: 271828,
  speed: { initial: DIFFICULTY_PRESETS.normal.initialSpeed, maximum: DIFFICULTY_PRESETS.normal.maximumSpeed },
  difficulty: { timeConstant: DIFFICULTY_PRESETS.normal.timeConstant, levels: 10 },
  onboarding: { seconds: 20, hintAt: 2, firstFlipAt: 4.5, easyBlockEvery: 4 },
  performance: { minimumFps: 45, sampleSeconds: 1, lowWindows: 3, warmupSeconds: 2, settleSeconds: 3 },
  scoring: { pointsPerMeter: 1, orbBonus: 100, orbsPerCombo: 3, maximumCombo: 5 },
  nearMiss: { minimumClearance: 0.02, clearance: 0.24, bonus: 50, cooldownSeconds: 1.2, timeScale: 0.45, slowSeconds: 0.18, popupSeconds: 0.75 },
  persistence: { key: "neon-drift.high-score.v1", profileKey: "neon-drift.profile.v1", saveInterval: 1000 },
  playtest: {
    historyKey: "neon-drift.runs.v1", maximumRuns: 50, saveInterval: 1000,
    timeBuckets: [0, 10, 20, 30, 45, 60, 90], feedbackEmail: "",
  },
  audio: {
    musicSource: "/audio/neon-drift.wav",
    effectsSource: "/audio/effects.wav",
    musicGain: 0.65,
    effectsGain: 0.75,
    maximumVoices: 8,
    sprites: { collect: [0, 320], hit: [400, 420], flip: [900, 500], gameOver: [1500, 1500] },
  },
  flight: {
    lanes: [-3.2, 0, 3.2],
    surfaceHeight: 2.65,
    laneChangeSeconds: 0.22,
    playerHalfExtents: { x: 0.8, y: 0.26, z: 1.05 },
  },
  flip: { duration: 0.3, cooldown: 0.72, forwardArc: 0.9 },
  spawn: {
    chunkCount: 6,
    rowsPerChunk: 4,
    cellsPerRow: 6,
    rowSpacing: DIFFICULTY_PRESETS.normal.rowSpacing,
    recycleBehind: 14,
    visibleDistance: 190,
    density: DIFFICULTY_PRESETS.normal.initialDensity,
    maximumDensity: DIFFICULTY_PRESETS.normal.maximumDensity,
  },
  obstacles: {
    block: { x: 1.16, y: 0.95, z: 0.85 },
    barrier: { x: 0.7, y: 1.25, z: 0.7 },
    laser: { x: 1.6, y: 1.15, z: 0.22 },
    barrierTravel: 2.15,
    barrierFrequency: DIFFICULTY_PRESETS.normal.barrierFrequency,
  },
  fairness: { clearance: 0.2, reactionSeconds: 0.22, maximumLaneSteps: 1 },
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