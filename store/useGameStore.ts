"use client";

import { createContext, createElement, useContext, type ReactNode } from "react";
import { useStore } from "zustand";
import type { GameState, GameStore } from "./gameStore";

const GameStoreContext = createContext<GameStore | null>(null);

export function GameStoreProvider({ store, children }: { store: GameStore; children: ReactNode }) {
  return createElement(GameStoreContext.Provider, { value: store }, children);
}

export function useGameStore<Selected>(selector: (state: GameState) => Selected): Selected {
  const store = useContext(GameStoreContext);
  if (!store) throw new Error("GameStoreProvider is required for the flight HUD.");
  return useStore(store, selector);
}