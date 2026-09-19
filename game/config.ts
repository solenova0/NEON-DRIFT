export const GAME_CONFIG = {
  seed: 271828,
  speed: { initial: 22, maximum: 40, acceleration: 0.22 },
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
    density: 0.62,
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
  },
  camera: { fov: 64, maximumFov: 76, distance: 11.5 },
  input: { swipeThreshold: 28, swipeMaximumSeconds: 0.7 },
} as const;

export type Surface = -1 | 1;
export type ObstacleKind = "block" | "barrier" | "laser";

export const OBSTACLE_CAPACITY =
  GAME_CONFIG.spawn.chunkCount *
  GAME_CONFIG.spawn.rowsPerChunk *
  GAME_CONFIG.spawn.cellsPerRow;

export const ORB_CAPACITY =
  GAME_CONFIG.spawn.chunkCount * GAME_CONFIG.spawn.rowsPerChunk;