import { GAME_CONFIG, type Surface } from "./config.ts";
import { difficultyAt, distanceAtTime } from "./difficulty.ts";
import { createGameStore, type GameStatus, type GameStore } from "../store/gameStore.ts";
import {
  createChunkPool,
  recycleChunks,
  resetChunkPool,
  type ObstacleSlot,
  type OrbSlot,
} from "./patterns.ts";

export interface FlightState {
  readonly status: GameStatus;
  time: number;
  distance: number;
  speed: number;
  density: number;
  readonly shield: number;
  readonly energy: number;
  readonly hits: number;
  readonly pickups: number;
  x: number;
  y: number;
  z: number;
  lane: number;
  surface: Surface;
  laneFromX: number;
  laneElapsed: number;
  laneDuration: number;
  flipping: boolean;
  flipElapsed: number;
  flipFromSurface: Surface;
  flipStartRoll: number;
  flipReadyAt: number;
  roll: number;
  invulnerableUntil: number;
  lastHitAt: number;
  lastCollectAt: number;
}

export type GameEvent =
  | { type: "hit"; shield: number; x: number; y: number; z: number }
  | { type: "collect"; energy: number; score: number; combo: number; bonus: number; x: number; y: number; z: number }
  | { type: "flip"; surface: Surface }
  | { type: "status"; status: GameStatus };

function initialMotion(): Omit<FlightState, "status" | "shield" | "energy" | "hits" | "pickups"> {
  return {
    time: 0,
    distance: 0,
    speed: GAME_CONFIG.speed.initial,
    density: GAME_CONFIG.spawn.density,
    x: 0,
    y: -GAME_CONFIG.flight.surfaceHeight,
    z: 0,
    lane: 1,
    surface: -1,
    laneFromX: 0,
    laneElapsed: 0,
    laneDuration: 0,
    flipping: false,
    flipElapsed: 0,
    flipFromSurface: -1,
    flipStartRoll: 0,
    flipReadyAt: 0,
    roll: 0,
    invulnerableUntil: 0,
    lastHitAt: -100,
    lastCollectAt: -100,
  };
}

function smoothstep(progress: number) {
  return progress * progress * (3 - 2 * progress);
}

export class FlightSimulation {
  readonly state: FlightState;
  readonly store: GameStore;
  readonly pool = createChunkPool();
  private readonly listeners = new Set<(event: GameEvent) => void>();

  constructor(store: GameStore = createGameStore()) {
    this.store = store;
    this.state = {
      ...initialMotion(),
      get status() { return store.getState().status; },
      get shield() { return store.getState().shield; },
      get energy() { return store.getState().energy; },
      get hits() { return store.getState().hits; },
      get pickups() { return store.getState().pickups; },
    };
    store.subscribe((current, previous) => {
      if (current.runId !== previous.runId) {
        Object.assign(this.state, initialMotion());
        resetChunkPool(this.pool);
      }
      if (current.status !== previous.status) this.emit({ type: "status", status: current.status });
    });
  }

  subscribe(listener: (event: GameEvent) => void) {
    this.listeners.add(listener);
    return () => { this.listeners.delete(listener); };
  }

  private emit(event: GameEvent) {
    for (const listener of this.listeners) listener(event);
  }

  start() {
    return this.store.getState().startRun();
  }

  togglePause() {
    if (this.state.status === "playing") this.pause();
    else this.store.getState().resumeRun();
  }

  pause() {
    this.publishTelemetry();
    return this.store.getState().pauseRun();
  }

  returnToMenu() {
    this.publishTelemetry();
    return this.store.getState().returnToMenu();
  }

  publishTelemetry() {
    const state = this.state;
    this.store.getState().syncTelemetry({
      elapsed: state.time,
      distance: state.distance,
      speed: state.speed,
      density: state.density,
      surface: state.surface,
      flipping: state.flipping,
      flipCharge: 1 - (state.flipReadyAt - state.time) / GAME_CONFIG.flip.cooldown,
    });
  }

  moveLane(direction: -1 | 1) {
    if (this.state.status !== "playing") return false;
    const screenDirection = Math.cos(this.state.roll) < 0 ? -direction : direction;
    const lane = Math.max(0, Math.min(2, this.state.lane + screenDirection));
    if (lane === this.state.lane) return false;
    this.state.laneFromX = this.state.x;
    this.state.laneElapsed = 0;
    this.state.laneDuration =
      (Math.abs(GAME_CONFIG.flight.lanes[lane] - this.state.x) /
        (GAME_CONFIG.flight.lanes[1] - GAME_CONFIG.flight.lanes[0])) *
      GAME_CONFIG.flight.laneChangeSeconds;
    this.state.lane = lane;
    return true;
  }

  requestFlip() {
    const state = this.state;
    if (state.status !== "playing" || state.flipping || state.time + 1e-8 < state.flipReadyAt) {
      return false;
    }
    state.flipping = true;
    state.flipElapsed = 0;
    state.flipFromSurface = state.surface;
    state.surface = -state.surface as Surface;
    state.flipStartRoll = state.roll;
    state.flipReadyAt = state.time + GAME_CONFIG.flip.cooldown;
    this.publishTelemetry();
    this.emit({ type: "flip", surface: state.surface });
    return true;
  }

  get invulnerable() {
    return this.state.flipping || this.state.time < this.state.invulnerableUntil;
  }

  hit(obstacle: ObstacleSlot) {
    if (this.state.status !== "playing" || !obstacle.active || obstacle.spent || this.invulnerable) {
      return false;
    }
    obstacle.spent = true;
    this.publishTelemetry();
    this.store.getState().recordHit();
    this.state.lastHitAt = this.state.time;
    this.state.invulnerableUntil = this.state.time + GAME_CONFIG.shield.recoverySeconds;
    this.emit({
      type: "hit", shield: this.state.shield,
      x: this.state.x, y: this.state.y, z: this.state.z,
    });
    return true;
  }

  collect(orb: OrbSlot) {
    if (this.state.status !== "playing" || !orb.active || orb.collected) return false;
    orb.collected = true;
    this.publishTelemetry();
    const bonus = this.store.getState().collectOrb();
    const { score, combo } = this.store.getState();
    this.state.lastCollectAt = this.state.time;
    this.emit({
      type: "collect", energy: this.state.energy, score, combo, bonus,
      x: this.state.x, y: this.state.y, z: this.state.z,
    });
    return true;
  }

  step(seconds: number) {
    const state = this.state;
    if (state.status !== "playing" || !Number.isFinite(seconds) || seconds <= 0) return;
    const previousTime = state.time;
    state.time += seconds;
    const difficulty = difficultyAt(state.time);
    state.speed = difficulty.speed;
    state.density = difficulty.density;
    state.distance += distanceAtTime(state.time) - distanceAtTime(previousTime);

    state.laneElapsed = Math.min(state.laneDuration, state.laneElapsed + seconds);
    const laneProgress = state.laneDuration === 0 ? 1 : smoothstep(state.laneElapsed / state.laneDuration);
    state.x = state.laneFromX + (GAME_CONFIG.flight.lanes[state.lane] - state.laneFromX) * laneProgress;

    if (state.flipping) {
      state.flipElapsed = Math.min(GAME_CONFIG.flip.duration, state.flipElapsed + seconds);
      const progress = state.flipElapsed / GAME_CONFIG.flip.duration;
      const eased = smoothstep(progress);
      state.y = GAME_CONFIG.flight.surfaceHeight *
        (state.flipFromSurface + (state.surface - state.flipFromSurface) * eased);
      state.z = -Math.sin(progress * Math.PI) * GAME_CONFIG.flip.forwardArc;
      state.roll = state.flipStartRoll + Math.PI * eased;
      if (progress >= 1 - 1e-8) {
        state.flipping = false;
        state.y = state.surface * GAME_CONFIG.flight.surfaceHeight;
        state.z = 0;
        state.roll = state.flipStartRoll + Math.PI;
      }
    }
    recycleChunks(this.pool, state.distance);
  }
}