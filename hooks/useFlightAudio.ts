"use client";

import { useEffect, type RefObject } from "react";
import { FlightAudio } from "@/game/audio";
import type { FlightSimulation } from "@/game/simulation";

export function useFlightAudio(simulation: FlightSimulation, surfaceRef: RefObject<HTMLElement | null>) {
  useEffect(() => {
    const surface = surfaceRef.current;
    let audio: FlightAudio | undefined;

    function unlock(event: Event) {
      if (!event.isTrusted || document.hidden) return;
      if (event instanceof KeyboardEvent && (event.repeat || event.ctrlKey || event.metaKey || event.altKey)) return;
      try {
        if (!audio) {
          const state = simulation.store.getState();
          audio = new FlightAudio(state.settings, state.status);
          if (process.env.NODE_ENV === "development" && surface) Reflect.set(surface, "__audio", audio);
        }
        audio.setForeground(true);
        audio.unlock();
      } catch {
        audio?.dispose();
        audio = undefined;
      }
    }

    const unsubscribeEvents = simulation.subscribe((event) => audio?.handle(event));
    const unsubscribeSettings = simulation.store.subscribe((current, previous) => {
      if (current.settings !== previous.settings) audio?.setSettings(current.settings);
    });
    const onBlur = () => audio?.setForeground(false);
    const onFocus = () => audio?.setForeground(!document.hidden);
    const onVisibility = () => audio?.setForeground(!document.hidden && document.hasFocus());
    window.addEventListener("pointerup", unlock);
    window.addEventListener("keydown", unlock);
    window.addEventListener("blur", onBlur);
    window.addEventListener("focus", onFocus);
    document.addEventListener("visibilitychange", onVisibility);
    return () => {
      unsubscribeEvents();
      unsubscribeSettings();
      window.removeEventListener("pointerup", unlock);
      window.removeEventListener("keydown", unlock);
      window.removeEventListener("blur", onBlur);
      window.removeEventListener("focus", onFocus);
      document.removeEventListener("visibilitychange", onVisibility);
      audio?.dispose();
      if (process.env.NODE_ENV === "development" && surface) Reflect.deleteProperty(surface, "__audio");
    };
  }, [simulation, surfaceRef]);
}