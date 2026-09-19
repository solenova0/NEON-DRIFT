import { create } from "zustand";
import { GAME_CONFIG, type Surface } from "@/game/config";
import type { FlightSimulation, RunStatus } from "@/game/simulation";

interface GameHudState {
  ready: boolean;
  status: RunStatus;
  shield: number;
  energy: number;
  distance: number;
  speed: number;
  surface: Surface;
  flipping: boolean;
  flipCharge: number;
  hits: number;
  pickups: number;
}

export const useGameStore = create<GameHudState>(() => ({
  ready: false,
  status: "ready",
  shield: GAME_CONFIG.shield.maximum,
  energy: 0,
  distance: 0,
  speed: GAME_CONFIG.speed.initial,
  surface: -1,
  flipping: false,
  flipCharge: 1,
  hits: 0,
  pickups: 0,
}));

export function publishHud(simulation: FlightSimulation) {
  const state = simulation.state;
  useGameStore.setState({
    status: state.status,
    shield: state.shield,
    energy: state.energy,
    distance: Math.floor(state.distance),
    speed: state.speed,
    surface: state.surface,
    flipping: state.flipping,
    flipCharge: Math.min(1, Math.max(0, 1 - (state.flipReadyAt - state.time) / GAME_CONFIG.flip.cooldown)),
    hits: state.hits,
    pickups: state.pickups,
  });
}