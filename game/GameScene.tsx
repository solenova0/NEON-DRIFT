"use client";

import { Suspense, useRef } from "react";
import { Canvas, useFrame } from "@react-three/fiber";
import { Bloom, ChromaticAberration, EffectComposer, Vignette } from "@react-three/postprocessing";
import { Vector2 } from "three";
import { GAME_CONFIG, QUALITY_PRESETS } from "@/game/config";
import { FlightEffects } from "@/game/FlightEffects";
import { ObstacleField } from "@/game/ObstacleField";
import { PhysicsWorld } from "@/game/PhysicsWorld";
import { Player } from "@/game/Player";
import { Tunnel } from "@/game/Tunnel";
import type { FlightSimulation } from "@/game/simulation";
import { selectReducedMotion } from "@/store/gameStore";
import { useGameStore } from "@/store/useGameStore";

const chromaticOffset = new Vector2(0.00035, 0.00035);
const noChromaticOffset = new Vector2(0, 0);

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

export default function GameScene({ simulation, onReady }: { simulation: FlightSimulation; onReady: () => void }) {
  const quality = useGameStore((state) => state.settings.quality);
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