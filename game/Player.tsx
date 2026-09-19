"use client";

import { useEffect, useRef, useState } from "react";
import { useFrame } from "@react-three/fiber";
import { Color, Group, MathUtils, Mesh, PerspectiveCamera } from "three";
import { GAME_CONFIG } from "@/game/config";
import { createCraftGeometry } from "@/game/geometry";
import type { FlightSimulation } from "@/game/simulation";
import { selectReducedMotion } from "@/store/gameStore";

export function Player({ simulation }: { simulation: FlightSimulation }) {
  const craft = useRef<Group>(null);
  const shield = useRef<Mesh>(null);
  const hitRemaining = useRef(0);
  const motionTime = useRef(0);
  const [resources] = useState(() => ({
    geometry: createCraftGeometry(),
    cyan: new Color("#79ffff").multiplyScalar(2.8),
    orange: new Color("#ff8158").multiplyScalar(3),
  }));

  useEffect(() => simulation.subscribe((event) => {
    if (event.type === "hit") hitRemaining.current = GAME_CONFIG.effects.hitSeconds;
    if (event.type === "status" && simulation.state.time === 0) hitRemaining.current = 0;
  }), [simulation]);

  useFrame(({ camera, size }, delta) => {
    const state = simulation.state;
    if (state.status === "paused") return;
    const reducedMotion = selectReducedMotion(simulation.store.getState());
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
      const speedRatio = (state.speed - GAME_CONFIG.speed.initial) /
        (GAME_CONFIG.speed.maximum - GAME_CONFIG.speed.initial);
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
    <group ref={craft} position={[0, -GAME_CONFIG.flight.surfaceHeight, 0]}>
      <mesh geometry={resources.geometry}>
        <meshStandardMaterial color="#e5ede9" roughness={0.27} metalness={0.72} />
      </mesh>
      <mesh position={[0, 0.15, -0.1]} scale={[0.22, 0.11, 0.58]}>
        <octahedronGeometry />
        <meshStandardMaterial color="#112f35" emissive="#2ce2e2" emissiveIntensity={0.55}
          roughness={0.15} metalness={0.8} />
      </mesh>
      {[-1, 1].map((side) => (
        <group key={side}>
          <mesh position={[side * 0.48, -0.035, 0.4]} rotation={[0, side * -0.62, 0]}>
            <boxGeometry args={[0.038, 0.025, 0.64]} />
            <meshBasicMaterial color={resources.cyan} toneMapped={false} />
          </mesh>
          <mesh position={[side * 0.23, -0.06, 0.79]}>
            <boxGeometry args={[0.17, 0.1, 0.12]} />
            <meshBasicMaterial color={resources.orange} toneMapped={false} />
          </mesh>
        </group>
      ))}
      <mesh ref={shield} visible={false} scale={[1.08, 0.58, 1.28]}>
        <icosahedronGeometry args={[1, 1]} />
        <meshBasicMaterial color="#95fff0" wireframe transparent opacity={0.45} toneMapped={false} />
      </mesh>
      <pointLight position={[0, 0.3, 0.2]} color="#b4ffff" intensity={16} distance={8} decay={2} />
    </group>
  );
}