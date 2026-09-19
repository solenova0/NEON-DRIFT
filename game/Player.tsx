"use client";

import { useEffect, useRef, useState } from "react";
import { useFrame } from "@react-three/fiber";
import { Color, EdgesGeometry, Group, MathUtils, Mesh, MeshBasicMaterial, PerspectiveCamera } from "three";
import { DIFFICULTY_PRESETS, GAME_CONFIG } from "@/game/config";
import { createCraftGeometry } from "@/game/geometry";
import type { FlightSimulation } from "@/game/simulation";
import { selectReducedMotion } from "@/store/gameStore";
import { THEME, comboColor } from "@/game/theme";

export function Player({ simulation }: { simulation: FlightSimulation }) {
  const craft = useRef<Group>(null);
  const shield = useRef<Mesh>(null);
  const hitRemaining = useRef(0);
  const motionTime = useRef(0);
  const engines = useRef<(MeshBasicMaterial | null)[]>([]);
  const lastCombo = useRef(-1);
  const [resources] = useState(() => {
    const geometry = createCraftGeometry();
    return { geometry, edges: new EdgesGeometry(geometry, 15), cyan: new Color(THEME.palette.primary).multiplyScalar(THEME.glow.craft) };
  });

  useEffect(() => () => { resources.geometry.dispose(); resources.edges.dispose(); }, [resources]);

  useEffect(() => simulation.subscribe((event) => {
    if (event.type === "hit") hitRemaining.current = GAME_CONFIG.effects.hitSeconds;
    if (event.type === "status" && simulation.state.time === 0) hitRemaining.current = 0;
  }), [simulation]);

  useFrame(({ camera, size }, delta) => {
    const state = simulation.state;
    if (state.status === "paused") return;
    const preferences = simulation.store.getState();
    const tuning = DIFFICULTY_PRESETS[preferences.runDifficulty];
    const reducedMotion = selectReducedMotion(preferences);
    if (lastCombo.current !== preferences.combo) {
      for (const material of engines.current) material?.color.set(comboColor(preferences.combo)).multiplyScalar(THEME.glow.engine);
      lastCombo.current = preferences.combo;
    }
    const frameDelta = Math.min(delta, GAME_CONFIG.physics.maximumFrameDelta);
    hitRemaining.current = Math.max(0, hitRemaining.current - frameDelta);
    if (!reducedMotion) motionTime.current += frameDelta;
    const hitPower = hitRemaining.current / GAME_CONFIG.effects.hitSeconds;
    const shake = reducedMotion ? 0 : hitPower * GAME_CONFIG.effects.shakeStrength;
    const shakeTime = hitRemaining.current * 130;
    const mobile = size.width < 700;
    const idle = state.status === "menu" && !reducedMotion;
    const driftX = idle ? Math.sin(motionTime.current * 0.32) * (mobile ? 0.35 : 0.65) : 0;
    const driftY = idle ? Math.sin(motionTime.current * 0.23) * 0.26 : 0;
    const desiredX = state.x * 0.16 + driftX;
    const desiredY = state.y * 0.12 + driftY;
    camera.position.x = reducedMotion ? desiredX : MathUtils.damp(camera.position.x, desiredX, 7, frameDelta);
    camera.position.y = (reducedMotion ? desiredY : MathUtils.damp(camera.position.y, desiredY, 7, frameDelta)) + Math.sin(shakeTime * 1.13) * shake;
    const cameraDistance = mobile ? GAME_CONFIG.camera.mobileDistance : GAME_CONFIG.camera.distance;
    camera.position.z = cameraDistance + (idle ? Math.sin(motionTime.current * 0.21) * 0.3 : 0);
    camera.position.x += Math.cos(shakeTime) * shake;
    const cameraRoll = reducedMotion ? Math.round(state.roll / Math.PI) * Math.PI : state.roll;
    camera.rotation.set(idle ? driftY * 0.012 : 0, idle ? -driftX * 0.012 : 0,
      cameraRoll + (idle ? Math.sin(motionTime.current * 0.27) * 0.016 : 0) + Math.sin(shakeTime * 0.7) * shake * 0.1);

    if (camera instanceof PerspectiveCamera) {
      const speedRatio = (state.speed - tuning.initialSpeed) / (tuning.maximumSpeed - tuning.initialSpeed);
      const speedKick = speedRatio * 0.65 + MathUtils.smoothstep(speedRatio, 0.5, 1) * 0.35;
      const desiredFov = (mobile ? GAME_CONFIG.camera.mobileFov : GAME_CONFIG.camera.fov) +
        (reducedMotion ? 0 : speedKick * (GAME_CONFIG.camera.maximumFov - GAME_CONFIG.camera.fov));
      const nextFov = reducedMotion ? desiredFov : MathUtils.damp(camera.fov, desiredFov, 4, frameDelta);
      if (Math.abs(camera.fov - nextFov) > 0.001) {
        camera.fov = nextFov;
        camera.updateProjectionMatrix();
      }
    }

    if (craft.current) {
      craft.current.position.set(state.x, state.y, state.z);
      const bank = reducedMotion ? 0 : (state.x - GAME_CONFIG.flight.lanes[state.lane]) * 0.1;
      craft.current.rotation.set(0, 0, state.roll + bank);
    }
    if (shield.current) {
      shield.current.visible = state.flipping ||
        (simulation.invulnerable && (reducedMotion || Math.floor(state.time * 18) % 2 === 0));
    }
  });

  return (
    <group name="player-craft" ref={craft} position={[0, -GAME_CONFIG.flight.surfaceHeight, 0]}>
      <mesh name="craft-hull" geometry={resources.geometry}>
        <meshStandardMaterial color={THEME.palette.hull} roughness={0.36} metalness={0.72} flatShading />
      </mesh>
      <lineSegments name="craft-edges" geometry={resources.edges}>
        <lineBasicMaterial color={resources.cyan} toneMapped={false} />
      </lineSegments>
      <mesh position={[0, 0.15, -0.1]} scale={[0.22, 0.11, 0.58]}>
        <octahedronGeometry />
        <meshStandardMaterial color={THEME.palette.glass} emissive={THEME.palette.primary} emissiveIntensity={THEME.glow.cockpit}
          roughness={0.15} metalness={0.8} />
      </mesh>
      {[-1, 1].map((side) => (
        <group key={side}>
          <mesh name={`engine-${side}`} position={[side * 0.3, -0.045, 0.54]}>
            <boxGeometry args={[0.17, 0.1, 0.12]} />
            <meshBasicMaterial ref={(material) => { engines.current[side === -1 ? 0 : 1] = material; }} color={resources.cyan} toneMapped={false} />
          </mesh>
        </group>
      ))}
      <mesh ref={shield} visible={false} scale={[1.08, 0.58, 1.28]}>
        <icosahedronGeometry args={[1, 1]} />
        <meshBasicMaterial color={THEME.palette.primary} wireframe transparent opacity={0.45} toneMapped={false} />
      </mesh>
      <pointLight position={[0, 0.3, 0.2]} color={THEME.palette.primary} intensity={THEME.lighting.craft} distance={8} decay={2} />
    </group>
  );
}