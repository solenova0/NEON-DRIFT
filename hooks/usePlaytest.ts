"use client";

import { useEffect } from "react";
import { GAME_CONFIG } from "@/game/config";
import type { FlightSimulation } from "@/game/simulation";
import { snapshotRun, validateRuns } from "@/store/runHistory";

export function usePlaytest(simulation: FlightSimulation) {
  useEffect(() => {
    const store = simulation.store;
    store.getState().setDebugEnabled(new URLSearchParams(location.search).get("debug") === "1");
    try {
      const saved = localStorage.getItem(GAME_CONFIG.playtest.historyKey);
      if (saved) store.getState().hydrateRunHistory(JSON.parse(saved));
    } catch {}

    let timer: ReturnType<typeof setTimeout> | undefined;
    function flush() {
      if (timer !== undefined) clearTimeout(timer);
      timer = undefined;
      const state = store.getState();
      const active = state.status === "playing" || state.status === "paused";
      const runs = validateRuns([...state.runHistory, ...(active ? [snapshotRun(state, "interrupted")] : [])]);
      try {
        localStorage.setItem(GAME_CONFIG.playtest.historyKey, JSON.stringify(runs));
        if (!state.historyStorageAvailable) store.setState({ historyStorageAvailable: true });
      } catch {
        if (state.historyStorageAvailable) store.setState({ historyStorageAvailable: false });
      }
    }

    const unsubscribe = store.subscribe((current, previous) => {
      if (current.runHistory !== previous.runHistory || current.status !== previous.status) flush();
      else if ((current.elapsed !== previous.elapsed || current.flips !== previous.flips || current.score !== previous.score)
        && timer === undefined) timer = setTimeout(flush, GAME_CONFIG.playtest.saveInterval);
    });
    function checkpoint() {
      simulation.publishTelemetry();
      flush();
    }
    const onHidden = () => { if (document.hidden) checkpoint(); };
    function onKey(event: KeyboardEvent) {
      if (event.code !== "Backquote" || event.repeat || event.ctrlKey || event.metaKey || event.altKey) return;
      if (event.target instanceof Element && event.target.closest("input, textarea, select, [contenteditable=true]")) return;
      event.preventDefault();
      store.getState().setDebugEnabled(!store.getState().debugEnabled);
    }
    window.addEventListener("keydown", onKey);
    window.addEventListener("pagehide", checkpoint);
    document.addEventListener("visibilitychange", onHidden);
    return () => {
      checkpoint();
      unsubscribe();
      window.removeEventListener("keydown", onKey);
      window.removeEventListener("pagehide", checkpoint);
      document.removeEventListener("visibilitychange", onHidden);
    };
  }, [simulation]);
}