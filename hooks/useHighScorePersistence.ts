"use client";

import { useEffect } from "react";
import { GAME_CONFIG } from "@/game/config";
import type { GameStore } from "@/store/gameStore";
import { createHighScorePersistence } from "@/store/highScore";

export function useHighScorePersistence(store: GameStore) {
  useEffect(() => {
    const persistence = createHighScorePersistence(() => window.localStorage);
    let savedScore = persistence.load();
    store.getState().hydrateHighScore(savedScore);
    let timer: ReturnType<typeof setTimeout> | undefined;

    function flush() {
      if (timer !== undefined) clearTimeout(timer);
      timer = undefined;
      const score = store.getState().highScore;
      if (score <= savedScore) return;
      savedScore = persistence.save(score);
      if (savedScore > score) store.getState().hydrateHighScore(savedScore);
    }

    const unsubscribe = store.subscribe((current, previous) => {
      if (current.status !== previous.status && current.status !== "playing") {
        flush();
      } else if (current.highScore > savedScore && timer === undefined) {
        timer = setTimeout(flush, GAME_CONFIG.persistence.saveInterval);
      }
    });
    const onVisibility = () => { if (document.hidden) flush(); };
    const onStorage = (event: StorageEvent) => {
      if (event.key === GAME_CONFIG.persistence.key) store.getState().hydrateHighScore(persistence.load());
    };
    window.addEventListener("pagehide", flush);
    window.addEventListener("storage", onStorage);
    document.addEventListener("visibilitychange", onVisibility);
    return () => {
      unsubscribe();
      window.removeEventListener("pagehide", flush);
      window.removeEventListener("storage", onStorage);
      document.removeEventListener("visibilitychange", onVisibility);
      flush();
    };
  }, [store]);
}