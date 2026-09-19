"use client";

import { Suspense, useEffect, useRef } from "react";
import { Canvas, useFrame, useThree } from "@react-three/fiber";
import { Bloom, ChromaticAberration, EffectComposer, Vignette } from "@react-three/postprocessing";
import { Vector2 } from "three";
import { GAME_CONFIG, QUALITY_PRESETS } from "@/game/config";
import { FlightEffects } from "@/game/FlightEffects";
import { ObstacleField } from "@/game/ObstacleField";
import { PhysicsWorld } from "@/game/PhysicsWorld";
import { Player } from "@/game/Player";
import { Tunnel } from "@/game/Tunnel";
import { FrameMonitor } from "@/game/performance";
import type { FlightSimulation } from "@/game/simulation";
import { selectEffectiveQuality, selectReducedMotion } from "@/store/gameStore";
import { useGameStore } from "@/store/useGameStore";

const chromaticOffset = new Vector2(0.00035, 0.00035);
const noChromaticOffset = new Vector2(0, 0);

function ContextGuard({ onError }: { onError: (error: Error) => void }) {
  const getScene = useThree((state) => state.get);
  useEffect(() => {
    const canvas = getScene().gl.domElement;
    const onContextLost = (event: Event) => {
      event.preventDefault();
      onError(new Error("WebGL context lost"));
    };
    canvas.addEventListener("webglcontextlost", onContextLost);
    return () => {
      canvas.removeEventListener("webglcontextlost", onContextLost);
      if (process.env.NODE_ENV === "development") {
        for (const key of ["__neon", "__renderer", "__scene", "__camera", "__physicsWorld"]) Reflect.deleteProperty(canvas, key);
      }
    };
  }, [getScene, onError]);
  return null;
}

function ScenePerformance({ simulation }: { simulation: FlightSimulation }) {
  const getScene = useThree((state) => state.get);
  const monitor = useRef(new FrameMonitor());
  const stats = useRef({ fps: 0, drawCalls: 0, triangles: 0, geometries: 0, textures: 0, downgrades: 0, quality: "high" });

  useEffect(() => {
    const renderer = getScene().gl;
    const autoReset = renderer.info.autoReset;
    if (process.env.NODE_ENV === "development") {
      renderer.info.autoReset = false;
      Reflect.set(renderer.domElement, "__performance", stats.current);
    }
    const unsubscribe = simulation.store.subscribe((current, previous) => {
      if (current.settings.quality !== previous.settings.quality || current.settings.adaptiveQuality !== previous.settings.adaptiveQuality) monitor.current.reset();
    });
    return () => {
      unsubscribe();
      renderer.info.autoReset = autoReset;
      Reflect.deleteProperty(renderer.domElement, "__performance");
    };
  }, [getScene, simulation]);

  useFrame(({ gl: renderer }, delta) => {
    const state = simulation.store.getState();
    const active = state.ready && !document.hidden && document.hasFocus() && state.status !== "paused" && state.status !== "gameOver" && state.panel === null;
    const report = monitor.current.sample(delta, active);
    if (report) {
      const downgraded = report.reduce && state.lowerQuality();
      if (process.env.NODE_ENV === "development") {
        Object.assign(stats.current, {
          fps: Math.round(report.fps), drawCalls: renderer.info.render.calls, triangles: renderer.info.render.triangles,
          geometries: renderer.info.memory.geometries, textures: renderer.info.memory.textures,
          downgrades: stats.current.downgrades + Number(downgraded), quality: selectEffectiveQuality(simulation.store.getState()),
        });
      }
    }
    if (process.env.NODE_ENV === "development") renderer.info.reset();
  }, -100);

  return null;
}

function HudClock({ simulation }: { simulation: FlightSimulation }) {
  const elapsed = useRef(0);
  useFrame((_, delta) => {
    elapsed.current += delta;
    if (elapsed.current >= 0.1) {
      simulation.publishTelemetry();
      elapsed.current = 0;
    }
  });
  return null;
}

export default function GameScene({ simulation, onReady, onError }: {
  simulation: FlightSimulation;
  onReady: () => void;
  onError: (error: Error) => void;
}) {
  const quality = useGameStore(selectEffectiveQuality);
  const reducedMotion = useGameStore(selectReducedMotion);
  const preset = QUALITY_PRESETS[quality];

  return (
    <Canvas camera={{ position: [0, 0, GAME_CONFIG.camera.distance], fov: GAME_CONFIG.camera.fov, near: 0.1, far: 250 }}
      dpr={[1, preset.dpr]}
      gl={{ antialias: false, alpha: false, powerPreference: "high-performance" }}
      onCreated={({ gl, scene, camera }) => {
        gl.setClearColor("#070d10");
        if (process.env.NODE_ENV === "development") {
          Object.assign(gl.domElement, { __neon: simulation, __renderer: gl, __scene: scene, __camera: camera });
        }
      }}>
      <color attach="background" args={["#070d10"]} />
      <fog attach="fog" args={["#070d10", 40, 192]} />
      <ambientLight intensity={1.35} color="#c5f6ee" />
      <directionalLight position={[4, 6, 7]} intensity={3.5} color="#e4fff5" />
      <pointLight position={[0, -1, -15]} color="#3dddcf" intensity={75} distance={35} />
      <pointLight position={[0, 2, -45]} color="#ff795b" intensity={95} distance={40} />
      <ContextGuard onError={onError} />
      <ScenePerformance simulation={simulation} />
      <Tunnel simulation={simulation} />
      <ObstacleField simulation={simulation} />
      <Player simulation={simulation} />
      <FlightEffects simulation={simulation} />
      <HudClock simulation={simulation} />
      <Suspense fallback={null}>
        <PhysicsWorld simulation={simulation} onReady={onReady} />
      </Suspense>
      {quality !== "low" && <EffectComposer multisampling={0}>
        <Bloom intensity={preset.bloom} luminanceThreshold={1}
          luminanceSmoothing={0.15} mipmapBlur levels={preset.bloomLevels} />
        <ChromaticAberration offset={quality === "high" && !reducedMotion ? chromaticOffset : noChromaticOffset} radialModulation={false} modulationOffset={0} />
        <Vignette eskil={false} offset={0.18} darkness={0.65} />
      </EffectComposer>}
    </Canvas>
  );
}