"use client";

import dynamic from "next/dynamic";
import { Component, useRef, useState, type ReactNode } from "react";
import { useProgress } from "@react-three/drei";
import { motion } from "framer-motion";
import { DefaultLoadingManager } from "three";
import { Zap } from "lucide-react";
import { FlightHud } from "@/components/FlightHud";
import { useFlightInput } from "@/hooks/useFlightInput";
import { useGamePreferences } from "@/hooks/useGamePreferences";
import { useHighScorePersistence } from "@/hooks/useHighScorePersistence";
import { FlightSimulation } from "@/game/simulation";
import { selectReducedMotion } from "@/store/gameStore";
import { GameStoreProvider, useGameStore } from "@/store/useGameStore";

let physicsLoadPending = false;

function completePhysicsLoading() {
  if (!physicsLoadPending) return;
  physicsLoadPending = false;
  DefaultLoadingManager.itemEnd("Physics sensors");
}

function SceneLoading() {
  const { active, progress, loaded, total } = useProgress();
  const ready = useGameStore((state) => state.ready);
  const reducedMotion = useGameStore(selectReducedMotion);
  const visible = !ready || active;
  const percent = Math.max(0, Math.min(100, Math.round(progress)));
  return (
    <motion.div className="scene-loading" role="status" aria-hidden={!visible} inert={!visible}
      data-testid="scene-loading" data-loaded={loaded} data-total={total}
      initial={false} animate={{ opacity: visible ? 1 : 0 }} transition={{ duration: reducedMotion ? 0 : 0.35 }}
      style={{ pointerEvents: visible ? "auto" : "none" }}>
      <Zap size={34} fill="currentColor" /><div className="loading-brand">NEON <span>DRIFT</span></div>
      <span className="loading-label">{ready ? "FLIGHT SYSTEMS ONLINE" : percent === 0 ? "LOADING FLIGHT SCENE" : "INITIALIZING PHYSICS"}</span>
      <div className="loading-progress">
        <div className="loading-track" role="progressbar" aria-label="Loading flight systems" aria-valuemin={0} aria-valuemax={100} aria-valuenow={percent}>
          <motion.span initial={false} animate={{ scaleX: percent / 100 }} transition={{ duration: reducedMotion ? 0 : 0.15 }} />
        </div>
        <strong>{String(percent).padStart(2, "0")}<small>%</small></strong>
      </div>
    </motion.div>
  );
}

const GameScene = dynamic(async () => {
  DefaultLoadingManager.itemStart("Flight scene");
  DefaultLoadingManager.itemStart("Physics sensors");
  physicsLoadPending = true;
  try {
    const scene = await import("@/game/GameScene");
    DefaultLoadingManager.itemEnd("Flight scene");
    return scene;
  } catch (error) {
    DefaultLoadingManager.itemError("Flight scene");
    DefaultLoadingManager.itemEnd("Flight scene");
    completePhysicsLoading();
    throw error;
  }
}, { ssr: false });

class SceneBoundary extends Component<{ children: ReactNode }, { failed: boolean }> {
  state = { failed: false };
  static getDerivedStateFromError() { return { failed: true }; }
  render() {
    if (this.state.failed) {
      return <div className="scene-error" role="alert"><h1>FLIGHT OFFLINE</h1><p>A WebGL2-capable browser with hardware acceleration is required.</p><button className="launch-button" onClick={() => location.reload()}>RECONNECT</button></div>;
    }
    return this.props.children;
  }
}

export default function NeonDrift() {
  const [simulation] = useState(() => new FlightSimulation());
  const surface = useRef<HTMLElement>(null);
  useFlightInput(simulation, surface);
  useHighScorePersistence(simulation.store);
  useGamePreferences(simulation.store);

  return (
    <GameStoreProvider store={simulation.store}>
      <main ref={surface} className="flight-shell" aria-label="Neon Drift gravity runner">
      <SceneBoundary>
        <div className="scene-viewport"><GameScene simulation={simulation} onReady={completePhysicsLoading} /></div>
        <FlightHud simulation={simulation} />
        <SceneLoading />
      </SceneBoundary>
      </main>
    </GameStoreProvider>
  );
}