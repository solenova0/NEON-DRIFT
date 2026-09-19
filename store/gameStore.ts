import { createStore } from "zustand/vanilla";
import { DIFFICULTY_PRESETS, GAME_CONFIG, QUALITY_PRESETS, type DifficultyPreset, type QualityPreset, type Surface } from "../game/config.ts";
import { snapshotRun, validateRuns, type DeathDetails, type PlaytestRun } from "./runHistory.ts";

export type GameStatus = "menu" | "playing" | "paused" | "gameOver";
export type GameTransition = "start" | "pause" | "resume" | "finish" | "menu";

export interface GameSettings {
  difficulty: DifficultyPreset;
  quality: QualityPreset;
  adaptiveQuality: boolean;
  masterVolume: number;
  musicVolume: number;
  effectsVolume: number;
  muted: boolean;
  showFeedback: boolean;
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
  difficulty: "normal",
  quality: "high",
  adaptiveQuality: true,
  masterVolume: 0.8,
  musicVolume: 0.6,
  effectsVolume: 0.85,
  muted: false,
  showFeedback: false,
  reducedMotion: null,
};

function settingsPatch(value: unknown): Partial<GameSettings> {
  if (!value || typeof value !== "object") return {};
  const input = value as Record<string, unknown>;
  const patch: Partial<GameSettings> = {};
  if (typeof input.difficulty === "string" && Object.hasOwn(DIFFICULTY_PRESETS, input.difficulty)) patch.difficulty = input.difficulty as DifficultyPreset;
  if (typeof input.quality === "string" && Object.hasOwn(QUALITY_PRESETS, input.quality)) {
    patch.quality = input.quality as QualityPreset;
  }
  for (const channel of ["masterVolume", "musicVolume", "effectsVolume"] as const) {
    const volume = input[channel];
    if (typeof volume === "number" && Number.isFinite(volume)) patch[channel] = Math.max(0, Math.min(1, volume));
  }
  if (typeof input.muted === "boolean") patch.muted = input.muted;
  if (typeof input.showFeedback === "boolean") patch.showFeedback = input.showFeedback;
  if (typeof input.adaptiveQuality === "boolean") patch.adaptiveQuality = input.adaptiveQuality;
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
  aliveTime?: number;
  distance: number;
  speed: number;
  density: number;
  surface: Surface;
  flipping: boolean;
  flipCharge: number;
}

interface RunState extends FlightTelemetry {
  aliveTime: number;
  score: number;
  distanceScore: number;
  orbBonus: number;
  nearMissBonus: number;
  nearMisses: number;
  combo: number;
  peakCombo: number;
  orbStreak: number;
  shield: number;
  energy: number;
  hits: number;
  pickups: number;
  flips: number;
}

export interface GameState extends RunState {
  status: GameStatus;
  ready: boolean;
  runId: number;
  runKey: string;
  runDifficulty: DifficultyPreset;
  highScore: number;
  bestAtStart: number;
  settings: GameSettings;
  qualityLimit: QualityPreset;
  systemReducedMotion: boolean;
  leaderboard: RunRecord[];
  runHistory: PlaytestRun[];
  hydrateRunHistory: (runs: unknown) => void;
  debugEnabled: boolean;
  debugFps: number;
  historyStorageAvailable: boolean;
  setDebugEnabled: (enabled: boolean) => void;
  setDebugFps: (fps: number) => void;
  panel: "settings" | "leaderboard" | "report" | null;
  updateSettings: (patch: Partial<GameSettings>) => void;
  lowerQuality: () => boolean;
  setSystemReducedMotion: (reduced: boolean) => void;
  hydrateProfile: (profile: unknown) => void;
  openPanel: (panel: "settings" | "leaderboard" | "report") => boolean;
  closePanel: () => void;
  setReady: (ready: boolean) => void;
  startRun: () => boolean;
  pauseRun: () => boolean;
  resumeRun: () => boolean;
  finishRun: () => boolean;
  returnToMenu: () => boolean;
  recordHit: (death?: DeathDetails) => boolean;
  recordFlip: () => void;
  recordNearMiss: () => number;
  collectOrb: () => number;
  syncTelemetry: (telemetry: FlightTelemetry) => void;
  hydrateHighScore: (score: number) => void;
}

function initialRun(preset: DifficultyPreset = "normal"): RunState {
  const tuning = DIFFICULTY_PRESETS[preset];
  return {
    elapsed: 0,
    aliveTime: 0,
    distance: 0,
    speed: tuning.initialSpeed,
    density: tuning.initialDensity,
    surface: -1,
    flipping: false,
    flipCharge: 1,
    score: 0,
    distanceScore: 0,
    orbBonus: 0,
    nearMissBonus: 0,
    nearMisses: 0,
    combo: 1,
    peakCombo: 1,
    orbStreak: 0,
    shield: GAME_CONFIG.shield.maximum,
    energy: 0,
    hits: 0,
    pickups: 0,
    flips: 0,
  };
}

export function createGameStore() {
  return createStore<GameState>()((set, get) => {
    function transition(event: GameTransition) {
      const current = get();
      const status = nextStatus(current.status, event);
      if (status === current.status) return false;
      if (event === "resume" && current.panel !== null) return false;
      set({ status, ...(status === "gameOver" ? {
        leaderboard: completedRecords(current),
        runHistory: validateRuns([...current.runHistory, snapshotRun(current, "finished")]),
      } : {}) });
      return true;
    }

    return {
      ...initialRun(),
      status: "menu",
      ready: false,
      runId: 0,
      runKey: "",
      runDifficulty: "normal",
      highScore: 0,
      bestAtStart: 0,
      settings: { ...DEFAULT_SETTINGS },
      qualityLimit: "high",
      systemReducedMotion: false,
      leaderboard: [],
      runHistory: [],
      hydrateRunHistory: (runs) => set((current) => ({ runHistory: validateRuns([...validateRuns(runs), ...current.runHistory]) })),
      debugEnabled: false,
      debugFps: 0,
      historyStorageAvailable: true,
      setDebugEnabled: (enabled) => set((current) => ({ debugEnabled: enabled, panel: !enabled && current.panel === "report" ? null : current.panel })),
      setDebugFps: (fps) => { if (Number.isFinite(fps) && fps >= 0) set({ debugFps: fps }); },
      panel: null,
      updateSettings: (patch) => {
        const valid = settingsPatch(patch);
        set((current) => ({
          settings: { ...current.settings, ...valid },
          qualityLimit: valid.quality !== undefined || valid.adaptiveQuality !== undefined ? "high" : current.qualityLimit,
        }));
      },
      lowerQuality: () => {
        const current = get();
        const quality = selectEffectiveQuality(current);
        if (!current.settings.adaptiveQuality || quality === "low") return false;
        set({ qualityLimit: quality === "high" ? "medium" : "low" });
        return true;
      },
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
        if (get().status === "playing" || (panel === "report" && !get().debugEnabled)) return false;
        set({ panel });
        return true;
      },
      closePanel: () => set({ panel: null }),
      setReady: (ready) => { set({ ready }); },
      startRun: () => {
        const current = get();
        if (!current.ready || current.panel !== null || nextStatus(current.status, "start") === current.status) return false;
        set({
          ...initialRun(current.settings.difficulty), runDifficulty: current.settings.difficulty,
          status: "playing", runId: current.runId + 1, bestAtStart: current.highScore,
          runKey: globalThis.crypto?.randomUUID?.() ?? `${Date.now()}-${Math.random()}`,
        });
        return true;
      },
      pauseRun: () => transition("pause"),
      resumeRun: () => transition("resume"),
      finishRun: () => transition("finish"),
      returnToMenu: () => {
        const current = get();
        if (nextStatus(current.status, "menu") === current.status) return false;
        set({
          ...initialRun(current.settings.difficulty), runDifficulty: current.settings.difficulty,
          status: "menu", panel: null, runId: current.runId + 1, bestAtStart: current.highScore,
          runHistory: current.status === "playing" || current.status === "paused"
            ? validateRuns([...current.runHistory, snapshotRun(current, "abandoned")]) : current.runHistory,
        });
        return true;
      },
      recordFlip: () => {
        if (get().status === "playing") set((current) => ({ flips: current.flips + 1 }));
      },
      recordNearMiss: () => {
        const current = get();
        if (current.status !== "playing") return 0;
        const bonus = GAME_CONFIG.nearMiss.bonus * current.combo;
        const score = current.score + bonus;
        set({ nearMisses: current.nearMisses + 1, nearMissBonus: current.nearMissBonus + bonus, score, highScore: Math.max(current.highScore, score) });
        return bonus;
      },
      recordHit: (death) => {
        const current = get();
        if (current.status !== "playing") return false;
        const shield = Math.max(0, current.shield - GAME_CONFIG.shield.hitDamage);
        set({
          shield,
          hits: current.hits + 1,
          combo: 1,
          orbStreak: 0,
          status: shield === 0 ? nextStatus(current.status, "finish") : current.status,
          ...(shield === 0 ? {
            leaderboard: completedRecords(current),
            runHistory: validateRuns([...current.runHistory, snapshotRun(current, "death", death)]),
          } : {}),
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
        const score = current.distanceScore + orbBonus + current.nearMissBonus;
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
        const tuning = DIFFICULTY_PRESETS[current.runDifficulty];
        if (current.status !== "playing") return;
        if (![telemetry.elapsed, telemetry.aliveTime ?? telemetry.elapsed, telemetry.distance, telemetry.speed, telemetry.density, telemetry.flipCharge].every(Number.isFinite)) return;
        const distance = Math.max(current.distance, telemetry.distance);
        const distanceScore = Math.floor(distance * GAME_CONFIG.scoring.pointsPerMeter);
        const score = distanceScore + current.orbBonus + current.nearMissBonus;
        set({
          ...telemetry,
          elapsed: Math.max(current.elapsed, telemetry.elapsed),
          aliveTime: Math.max(current.aliveTime, telemetry.aliveTime ?? telemetry.elapsed),
          distance,
          speed: Math.max(tuning.initialSpeed, Math.min(tuning.maximumSpeed, telemetry.speed)),
          density: Math.max(tuning.initialDensity, Math.min(tuning.maximumDensity, telemetry.density)),
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

export function selectEffectiveQuality(state: GameState): QualityPreset {
  if (!state.settings.adaptiveQuality) return state.settings.quality;
  const order: QualityPreset[] = ["low", "medium", "high"];
  return order[Math.min(order.indexOf(state.settings.quality), order.indexOf(state.qualityLimit))];
}