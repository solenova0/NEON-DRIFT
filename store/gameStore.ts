import { createStore } from "zustand/vanilla";
import { GAME_CONFIG, QUALITY_PRESETS, type QualityPreset, type Surface } from "../game/config.ts";

export type GameStatus = "menu" | "playing" | "paused" | "gameOver";
export type GameTransition = "start" | "pause" | "resume" | "finish" | "menu";

export interface GameSettings {
  quality: QualityPreset;
  masterVolume: number;
  musicVolume: number;
  effectsVolume: number;
  reducedMotion: boolean | null;
}

export interface RunRecord {
  id: number;
  score: number;
  distance: number;
  pickups: number;
  peakCombo: number;
}

export const DEFAULT_SETTINGS: GameSettings = {
  quality: "high",
  masterVolume: 0.8,
  musicVolume: 0.6,
  effectsVolume: 0.85,
  reducedMotion: null,
};

function settingsPatch(value: unknown): Partial<GameSettings> {
  if (!value || typeof value !== "object") return {};
  const input = value as Record<string, unknown>;
  const patch: Partial<GameSettings> = {};
  if (typeof input.quality === "string" && Object.hasOwn(QUALITY_PRESETS, input.quality)) {
    patch.quality = input.quality as QualityPreset;
  }
  for (const channel of ["masterVolume", "musicVolume", "effectsVolume"] as const) {
    const volume = input[channel];
    if (typeof volume === "number" && Number.isFinite(volume)) patch[channel] = Math.max(0, Math.min(1, volume));
  }
  if (typeof input.reducedMotion === "boolean" || input.reducedMotion === null) patch.reducedMotion = input.reducedMotion;
  return patch;
}

function validRecords(value: unknown): RunRecord[] {
  if (!Array.isArray(value)) return [];
  const records = value.filter((entry): entry is RunRecord => {
    if (!entry || typeof entry !== "object") return false;
    return [entry.id, entry.score, entry.distance, entry.pickups, entry.peakCombo].every(Number.isSafeInteger)
      && entry.id > 0 && entry.id < Number.MAX_SAFE_INTEGER && entry.score > 0 && entry.distance >= 0
      && entry.pickups >= 0 && entry.peakCombo >= 1 && entry.peakCombo <= GAME_CONFIG.scoring.maximumCombo;
  });
  const unique = new Map(records.map(({ id, score, distance, pickups, peakCombo }) => [id, { id, score, distance, pickups, peakCombo }]));
  return [...unique.values()].sort((first, second) => second.score - first.score || second.id - first.id).slice(0, 5);
}

function completedRecords(current: GameState): RunRecord[] {
  if (current.score <= 0) return current.leaderboard;
  const id = Math.max(0, ...current.leaderboard.map((entry) => entry.id)) + 1;
  return validRecords([...current.leaderboard, {
    id, score: current.score, distance: Math.floor(current.distance), pickups: current.pickups, peakCombo: current.peakCombo,
  }]);
}

const transitions: Record<GameStatus, Partial<Record<GameTransition, GameStatus>>> = {
  menu: { start: "playing" },
  playing: { pause: "paused", finish: "gameOver", menu: "menu" },
  paused: { resume: "playing", menu: "menu" },
  gameOver: { start: "playing", menu: "menu" },
};

export function nextStatus(status: GameStatus, transition: GameTransition) {
  return transitions[status][transition] ?? status;
}

export interface FlightTelemetry {
  elapsed: number;
  distance: number;
  speed: number;
  density: number;
  surface: Surface;
  flipping: boolean;
  flipCharge: number;
}

interface RunState extends FlightTelemetry {
  score: number;
  distanceScore: number;
  orbBonus: number;
  combo: number;
  peakCombo: number;
  orbStreak: number;
  shield: number;
  energy: number;
  hits: number;
  pickups: number;
}

export interface GameState extends RunState {
  status: GameStatus;
  ready: boolean;
  runId: number;
  highScore: number;
  bestAtStart: number;
  settings: GameSettings;
  systemReducedMotion: boolean;
  leaderboard: RunRecord[];
  panel: "settings" | "leaderboard" | null;
  updateSettings: (patch: Partial<GameSettings>) => void;
  setSystemReducedMotion: (reduced: boolean) => void;
  hydrateProfile: (profile: unknown) => void;
  openPanel: (panel: "settings" | "leaderboard") => boolean;
  closePanel: () => void;
  setReady: (ready: boolean) => void;
  startRun: () => boolean;
  pauseRun: () => boolean;
  resumeRun: () => boolean;
  finishRun: () => boolean;
  returnToMenu: () => boolean;
  recordHit: () => boolean;
  collectOrb: () => number;
  syncTelemetry: (telemetry: FlightTelemetry) => void;
  hydrateHighScore: (score: number) => void;
}

function initialRun(): RunState {
  return {
    elapsed: 0,
    distance: 0,
    speed: GAME_CONFIG.speed.initial,
    density: GAME_CONFIG.spawn.density,
    surface: -1,
    flipping: false,
    flipCharge: 1,
    score: 0,
    distanceScore: 0,
    orbBonus: 0,
    combo: 1,
    peakCombo: 1,
    orbStreak: 0,
    shield: GAME_CONFIG.shield.maximum,
    energy: 0,
    hits: 0,
    pickups: 0,
  };
}

export function createGameStore() {
  return createStore<GameState>()((set, get) => {
    function transition(event: GameTransition) {
      const current = get();
      const status = nextStatus(current.status, event);
      if (status === current.status) return false;
      if (event === "resume" && current.panel !== null) return false;
      set({ status, ...(status === "gameOver" ? { leaderboard: completedRecords(current) } : {}) });
      return true;
    }

    return {
      ...initialRun(),
      status: "menu",
      ready: false,
      runId: 0,
      highScore: 0,
      bestAtStart: 0,
      settings: { ...DEFAULT_SETTINGS },
      systemReducedMotion: false,
      leaderboard: [],
      panel: null,
      updateSettings: (patch) => set((current) => ({ settings: { ...current.settings, ...settingsPatch(patch) } })),
      setSystemReducedMotion: (systemReducedMotion) => set({ systemReducedMotion }),
      hydrateProfile: (profile) => {
        if (!profile || typeof profile !== "object") return;
        const input = profile as Record<string, unknown>;
        const leaderboard = validRecords(input.leaderboard);
        set((current) => ({
          settings: { ...current.settings, ...settingsPatch(input.settings) },
          leaderboard,
          highScore: Math.max(current.highScore, ...leaderboard.map((entry) => entry.score)),
        }));
      },
      openPanel: (panel) => {
        if (get().status === "playing") return false;
        set({ panel });
        return true;
      },
      closePanel: () => set({ panel: null }),
      setReady: (ready) => { set({ ready }); },
      startRun: () => {
        const current = get();
        if (!current.ready || current.panel !== null || nextStatus(current.status, "start") === current.status) return false;
        set({ ...initialRun(), status: "playing", runId: current.runId + 1, bestAtStart: current.highScore });
        return true;
      },
      pauseRun: () => transition("pause"),
      resumeRun: () => transition("resume"),
      finishRun: () => transition("finish"),
      returnToMenu: () => {
        const current = get();
        if (nextStatus(current.status, "menu") === current.status) return false;
        set({ ...initialRun(), status: "menu", panel: null, runId: current.runId + 1, bestAtStart: current.highScore });
        return true;
      },
      recordHit: () => {
        const current = get();
        if (current.status !== "playing") return false;
        const shield = Math.max(0, current.shield - GAME_CONFIG.shield.hitDamage);
        set({
          shield,
          hits: current.hits + 1,
          combo: 1,
          orbStreak: 0,
          status: shield === 0 ? nextStatus(current.status, "finish") : current.status,
          ...(shield === 0 ? { leaderboard: completedRecords(current) } : {}),
        });
        return true;
      },
      collectOrb: () => {
        const current = get();
        if (current.status !== "playing") return 0;
        const orbStreak = current.orbStreak + 1;
        const combo = Math.min(GAME_CONFIG.scoring.maximumCombo,
          1 + Math.floor(orbStreak / GAME_CONFIG.scoring.orbsPerCombo));
        const awarded = GAME_CONFIG.scoring.orbBonus * combo;
        const orbBonus = current.orbBonus + awarded;
        const score = current.distanceScore + orbBonus;
        set({
          orbStreak, combo, orbBonus, score, peakCombo: Math.max(current.peakCombo, combo),
          highScore: Math.max(current.highScore, score),
          pickups: current.pickups + 1,
          energy: current.energy + GAME_CONFIG.orbs.energy,
        });
        return awarded;
      },
      syncTelemetry: (telemetry) => {
        const current = get();
        if (current.status !== "playing") return;
        if (![telemetry.elapsed, telemetry.distance, telemetry.speed, telemetry.density, telemetry.flipCharge].every(Number.isFinite)) return;
        const distance = Math.max(current.distance, telemetry.distance);
        const distanceScore = Math.floor(distance * GAME_CONFIG.scoring.pointsPerMeter);
        const score = distanceScore + current.orbBonus;
        set({
          ...telemetry,
          elapsed: Math.max(current.elapsed, telemetry.elapsed),
          distance,
          speed: Math.max(GAME_CONFIG.speed.initial, Math.min(GAME_CONFIG.speed.maximum, telemetry.speed)),
          density: Math.max(GAME_CONFIG.spawn.density, Math.min(GAME_CONFIG.spawn.maximumDensity, telemetry.density)),
          flipCharge: Math.max(0, Math.min(1, telemetry.flipCharge)),
          distanceScore, score,
          highScore: Math.max(current.highScore, score),
        });
      },
      hydrateHighScore: (score) => {
        if (!Number.isSafeInteger(score) || score < 0) return;
        set((current) => ({
          highScore: Math.max(current.highScore, score),
          bestAtStart: Math.max(current.bestAtStart, score),
        }));
      },
    };
  });
}

export type GameStore = ReturnType<typeof createGameStore>;

export const selectReducedMotion = (state: GameState) => state.settings.reducedMotion ?? state.systemReducedMotion;