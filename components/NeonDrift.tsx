"use client";

import dynamic from "next/dynamic";
import { Component, Fragment, useRef, useState, type ReactNode, type RefObject } from "react";
import { useProgress } from "@react-three/drei";
import { motion } from "framer-motion";
import { DefaultLoadingManager } from "three";
import { RotateCcw, Zap } from "lucide-react";
import { FlightHud } from "@/components/FlightHud";
import { useFlightAudio } from "@/hooks/useFlightAudio";
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

class SceneBoundary extends Component<{
  simulation: FlightSimulation;
  children: (onError: (error: Error) => void) => ReactNode;
}, { failed: boolean; attempt: number }> {
  state = { failed: false, attempt: 0 };
  static getDerivedStateFromError() { return { failed: true }; }

  componentDidCatch() {
    this.props.simulation.pause();
    this.props.simulation.store.getState().setReady(false);
    completePhysicsLoading();
  }

  handleError = () => {
    this.props.simulation.pause();
    this.props.simulation.store.getState().setReady(false);
    completePhysicsLoading();
    this.setState({ failed: true });
  };

  reconnect = () => {
    const { simulation } = this.props;
    simulation.returnToMenu();
    simulation.store.getState().closePanel();
    simulation.store.getState().updateSettings({ quality: "low" });
    simulation.store.getState().setReady(false);
    DefaultLoadingManager.itemStart("Physics sensors");
    physicsLoadPending = true;
    this.setState((current) => ({ failed: false, attempt: current.attempt + 1 }));
  };

  render() {
    if (this.state.failed) {
      return (
        <section className="scene-error" role="alert" aria-labelledby="recovery-title">
          <Zap size={34} /><h1 id="recovery-title">FLIGHT INTERRUPTED</h1>
          <p>The renderer could not continue. Your saved records and settings are still available. Reconnect with lighter graphics, or reload in a WebGL2-capable browser with hardware acceleration.</p>
          <button type="button" className="launch-button" autoFocus onClick={this.reconnect}><RotateCcw size={17} />RECONNECT</button>
          <button type="button" className="secondary-button" onClick={() => location.reload()}>RELOAD PAGE</button>
        </section>
      );
    }
    return <Fragment key={this.state.attempt}>{this.props.children(this.handleError)}</Fragment>;
  }
}

function FlightSession({ simulation, surface, onError }: {
  simulation: FlightSimulation;
  surface: RefObject<HTMLElement | null>;
  onError: (error: Error) => void;
}) {
  useFlightInput(simulation, surface);
  useFlightAudio(simulation, surface);
  return (
    <>
      <div className="scene-viewport"><GameScene simulation={simulation} onReady={completePhysicsLoading} onError={onError} /></div>
      <FlightHud simulation={simulation} />
      <SceneLoading />
    </>
  );
}

export default function NeonDrift() {
  const [simulation] = useState(() => new FlightSimulation());
  const surface = useRef<HTMLElement>(null);
  useHighScorePersistence(simulation.store);
  useGamePreferences(simulation.store);

  return (
    <GameStoreProvider store={simulation.store}>
      <main ref={surface} className="flight-shell" aria-label="Neon Drift gravity runner">
        <SceneBoundary simulation={simulation}>
          {(onError) => <FlightSession simulation={simulation} surface={surface} onError={onError} />}
        </SceneBoundary>
      </main>
    </GameStoreProvider>
  );
}