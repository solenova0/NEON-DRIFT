import { GAME_CONFIG, type Surface } from "./config.ts";
import {
  createChunkPool,
  recycleChunks,
  resetChunkPool,
  type ObstacleSlot,
  type OrbSlot,
} from "./patterns.ts";

export type RunStatus = "ready" | "running" | "paused" | "gameover";

export interface FlightState {
  status: RunStatus;
  time: number;
  distance: number;
  speed: number;
  shield: number;
  energy: number;
  hits: number;
  pickups: number;
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
  | { type: "collect"; energy: number; x: number; y: number; z: number }
  | { type: "flip"; surface: Surface }
  | { type: "status"; status: RunStatus };

function initialState(): FlightState {
  return {
    status: "ready",
    time: 0,
    distance: 0,
    speed: GAME_CONFIG.speed.initial,
    shield: GAME_CONFIG.shield.maximum,
    energy: 0,
    hits: 0,
    pickups: 0,
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
  readonly state = initialState();
  readonly pool = createChunkPool();
  private readonly listeners = new Set<(event: GameEvent) => void>();

  subscribe(listener: (event: GameEvent) => void) {
    this.listeners.add(listener);
    return () => { this.listeners.delete(listener); };
  }

  private emit(event: GameEvent) {
    for (const listener of this.listeners) listener(event);
  }

  start() {
    if (this.state.status !== "ready" && this.state.status !== "gameover") return;
    Object.assign(this.state, initialState(), { status: "running" });
    resetChunkPool(this.pool);
    this.emit({ type: "status", status: "running" });
  }

  togglePause() {
    if (this.state.status !== "running" && this.state.status !== "paused") return;
    this.state.status = this.state.status === "running" ? "paused" : "running";
    this.emit({ type: "status", status: this.state.status });
  }

  pause() {
    if (this.state.status === "running") this.togglePause();
  }

  moveLane(direction: -1 | 1) {
    if (this.state.status !== "running") return false;
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
    if (state.status !== "running" || state.flipping || state.time + 1e-8 < state.flipReadyAt) {
      return false;
    }
    state.flipping = true;
    state.flipElapsed = 0;
    state.flipFromSurface = state.surface;
    state.surface = -state.surface as Surface;
    state.flipStartRoll = state.roll;
    state.flipReadyAt = state.time + GAME_CONFIG.flip.cooldown;
    this.emit({ type: "flip", surface: state.surface });
    return true;
  }

  get invulnerable() {
    return this.state.flipping || this.state.time < this.state.invulnerableUntil;
  }

  hit(obstacle: ObstacleSlot) {
    if (this.state.status !== "running" || !obstacle.active || obstacle.spent || this.invulnerable) {
      return false;
    }
    obstacle.spent = true;
    this.state.shield = Math.max(0, this.state.shield - GAME_CONFIG.shield.hitDamage);
    this.state.hits += 1;
    this.state.lastHitAt = this.state.time;
    this.state.invulnerableUntil = this.state.time + GAME_CONFIG.shield.recoverySeconds;
    this.emit({
      type: "hit", shield: this.state.shield,
      x: this.state.x, y: this.state.y, z: this.state.z,
    });
    if (this.state.shield === 0) {
      this.state.status = "gameover";
      this.emit({ type: "status", status: "gameover" });
    }
    return true;
  }

  collect(orb: OrbSlot) {
    if (this.state.status !== "running" || !orb.active || orb.collected) return false;
    orb.collected = true;
    this.state.energy += GAME_CONFIG.orbs.energy;
    this.state.pickups += 1;
    this.state.lastCollectAt = this.state.time;
    this.emit({
      type: "collect", energy: this.state.energy,
      x: this.state.x, y: this.state.y, z: this.state.z,
    });
    return true;
  }

  step(seconds: number) {
    const state = this.state;
    if (state.status !== "running" || seconds <= 0) return;
    state.time += seconds;
    const previousSpeed = state.speed;
    state.speed = Math.min(
      GAME_CONFIG.speed.maximum,
      GAME_CONFIG.speed.initial + state.time * GAME_CONFIG.speed.acceleration,
    );
    state.distance += ((previousSpeed + state.speed) / 2) * seconds;

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