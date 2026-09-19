"use client";

import { useEffect, type RefObject } from "react";
import { GAME_CONFIG } from "@/game/config";
import type { FlightSimulation } from "@/game/simulation";

export function useFlightInput(
  simulation: FlightSimulation,
  surfaceRef: RefObject<HTMLElement | null>,
) {
  useEffect(() => {
    const surface = surfaceRef.current;
    if (!surface) return;
    let gesture: { id: number; x: number; y: number; time: number } | null = null;

    function onKeyDown(event: KeyboardEvent) {
      if (event.target instanceof Element && event.target.closest("input, textarea, select, [contenteditable=true]")) return;
      const supported = ["Space", "ArrowLeft", "ArrowRight", "ArrowUp", "KeyA", "KeyD", "KeyW", "Escape", "KeyP", "Enter"];
      if (!supported.includes(event.code)) return;
      if (event.code === "Space" && event.target instanceof Element && event.target.closest("button")) return;
      event.preventDefault();
      if (event.repeat) return;
      if (event.code === "ArrowLeft" || event.code === "KeyA") simulation.moveLane(-1);
      if (event.code === "ArrowRight" || event.code === "KeyD") simulation.moveLane(1);
      if (["Space", "ArrowUp", "KeyW"].includes(event.code)) simulation.requestFlip();
      if (event.code === "Escape" || event.code === "KeyP") simulation.togglePause();
      if (event.code === "Enter") {
        if (simulation.state.status === "paused") simulation.togglePause();
        else simulation.start();
      }
    }

    function onPointerDown(event: PointerEvent) {
      if (event.pointerType === "mouse" || !event.isPrimary) return;
      if (event.target instanceof Element && event.target.closest("button, a")) return;
      gesture = { id: event.pointerId, x: event.clientX, y: event.clientY, time: performance.now() };
      surface!.setPointerCapture(event.pointerId);
    }

    function onPointerUp(event: PointerEvent) {
      if (!gesture || gesture.id !== event.pointerId) return;
      const deltaX = event.clientX - gesture.x;
      const deltaY = event.clientY - gesture.y;
      const duration = (performance.now() - gesture.time) / 1000;
      gesture = null;
      if (surface!.hasPointerCapture(event.pointerId)) surface!.releasePointerCapture(event.pointerId);
      if (duration > GAME_CONFIG.input.swipeMaximumSeconds) return;
      if (Math.max(Math.abs(deltaX), Math.abs(deltaY)) < GAME_CONFIG.input.swipeThreshold) return;
      if (Math.abs(deltaY) > Math.abs(deltaX)) {
        if (deltaY < 0) simulation.requestFlip();
      } else {
        simulation.moveLane(deltaX < 0 ? -1 : 1);
      }
    }

    const cancelGesture = () => { gesture = null; };
    const onVisibility = () => { if (document.hidden) simulation.pause(); };
    const onBlur = () => simulation.pause();

    window.addEventListener("keydown", onKeyDown);
    window.addEventListener("blur", onBlur);
    document.addEventListener("visibilitychange", onVisibility);
    surface.addEventListener("pointerdown", onPointerDown);
    surface.addEventListener("pointerup", onPointerUp);
    surface.addEventListener("pointercancel", cancelGesture);
    surface.addEventListener("lostpointercapture", cancelGesture);
    return () => {
      window.removeEventListener("keydown", onKeyDown);
      window.removeEventListener("blur", onBlur);
      document.removeEventListener("visibilitychange", onVisibility);
      surface.removeEventListener("pointerdown", onPointerDown);
      surface.removeEventListener("pointerup", onPointerUp);
      surface.removeEventListener("pointercancel", cancelGesture);
      surface.removeEventListener("lostpointercapture", cancelGesture);
    };
  }, [simulation, surfaceRef]);
}