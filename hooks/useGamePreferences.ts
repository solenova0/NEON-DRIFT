"use client";

import { useEffect } from "react";
import { GAME_CONFIG } from "@/game/config";
import { selectReducedMotion, type GameStore } from "@/store/gameStore";

export function useGamePreferences(store: GameStore) {
  useEffect(() => {
    const motionPreference = window.matchMedia("(prefers-reduced-motion: reduce)");
    const syncMotion = () => store.getState().setSystemReducedMotion(motionPreference.matches);
    syncMotion();
    if (window.matchMedia("(pointer: coarse), (max-width: 700px)").matches) {
      store.getState().updateSettings({ quality: "medium" });
    }
    try {
      const saved = window.localStorage.getItem(GAME_CONFIG.persistence.profileKey);
      if (saved) store.getState().hydrateProfile(JSON.parse(saved));
    } catch {}

    const root = document.documentElement;
    const previousMotion = root.dataset.reducedMotion;
    const applyMotion = () => { root.dataset.reducedMotion = String(selectReducedMotion(store.getState())); };
    applyMotion();
    let dirty = false;
    let timer: ReturnType<typeof setTimeout> | undefined;

    function flush() {
      if (timer !== undefined) clearTimeout(timer);
      timer = undefined;
      if (!dirty) return;
      const { settings, leaderboard } = store.getState();
      try {
        window.localStorage.setItem(GAME_CONFIG.persistence.profileKey, JSON.stringify({ settings, leaderboard }));
      } catch {}
      dirty = false;
    }

    const unsubscribe = store.subscribe((current, previous) => {
      if (selectReducedMotion(current) !== selectReducedMotion(previous)) applyMotion();
      if (current.settings !== previous.settings || current.leaderboard !== previous.leaderboard) {
        dirty = true;
        if (current.leaderboard !== previous.leaderboard) flush();
        else if (timer === undefined) timer = setTimeout(flush, 200);
      }
    });
    const onVisibility = () => { if (document.hidden) flush(); };
    motionPreference.addEventListener("change", syncMotion);
    window.addEventListener("pagehide", flush);
    document.addEventListener("visibilitychange", onVisibility);
    return () => {
      flush();
      unsubscribe();
      motionPreference.removeEventListener("change", syncMotion);
      window.removeEventListener("pagehide", flush);
      document.removeEventListener("visibilitychange", onVisibility);
      if (previousMotion === undefined) delete root.dataset.reducedMotion;
      else root.dataset.reducedMotion = previousMotion;
    };
  }, [store]);
}