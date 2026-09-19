"use client";

import { useEffect, useRef } from "react";
import { useFrame } from "@react-three/fiber";
import { AdditiveBlending, Color, DynamicDrawUsage, InstancedMesh, MathUtils, MeshBasicMaterial, Object3D } from "three";
import { GAME_CONFIG, QUALITY_PRESETS } from "@/game/config";
import type { FlightSimulation } from "@/game/simulation";
import { selectReducedMotion } from "@/store/gameStore";

export function FlightEffects({ simulation }: { simulation: FlightSimulation }) {
  const mesh = useRef<InstancedMesh>(null);
  const speedLines = useRef<InstancedMesh>(null);
  const speedMaterial = useRef<MeshBasicMaterial>(null);
  const poolRef = useRef({
    particles: Array.from({ length: GAME_CONFIG.effects.particleCount }, () => ({
      x: 0, y: 0, z: 0, velocityX: 0, velocityY: 0, velocityZ: 0,
      life: 0, maximumLife: 1, radius: 0.1, color: new Color(), trail: false,
    })),
    cursor: 0,
    trailElapsed: 0,
    colorDirty: true,
    transform: new Object3D(),
  });

  useEffect(() => {
    mesh.current?.instanceMatrix.setUsage(DynamicDrawUsage);
    speedLines.current?.instanceMatrix.setUsage(DynamicDrawUsage);
    return simulation.subscribe((event) => {
      const pool = poolRef.current;
      if (event.type === "status" && simulation.state.time === 0) {
        for (const particle of pool.particles) particle.life = 0;
      }
      if (event.type !== "hit" && event.type !== "collect") return;
      const preferences = simulation.store.getState();
      if (selectReducedMotion(preferences)) return;
      const budget = QUALITY_PRESETS[preferences.settings.quality].particles;
      const count = Math.ceil(budget * (event.type === "hit" ? 0.42 : 0.25));
      for (let index = 0; index < count; index += 1) {
        const particle = pool.particles[pool.cursor++ % budget];
        const angle = index * 2.39996;
        const vertical = (index / count) * 2 - 1;
        particle.x = event.x;
        particle.y = event.y;
        particle.z = event.z;
        particle.velocityX = Math.cos(angle) * 4;
        particle.velocityY = vertical * 5;
        particle.velocityZ = Math.sin(angle) * 4 + 3;
        particle.life = GAME_CONFIG.effects.particleSeconds;
        particle.maximumLife = particle.life;
        particle.radius = event.type === "hit" ? 0.09 : 0.075;
        particle.trail = false;
        particle.color.set(event.type === "hit" ? "#ff926d" : "#d5fa87").multiplyScalar(2.6);
      }
      pool.colorDirty = true;
    });
  }, [simulation]);

  useFrame((_, delta) => {
    if (!mesh.current) return;
    const pool = poolRef.current;
    const state = simulation.state;
    const preferences = simulation.store.getState();
    const reducedMotion = selectReducedMotion(preferences);
    const preset = QUALITY_PRESETS[preferences.settings.quality];
    const budget = reducedMotion ? 0 : preset.particles;
    const speedPower = MathUtils.smoothstep(state.speed, 29, GAME_CONFIG.speed.maximum);
    mesh.current.count = budget;
    const frameDelta = state.status === "paused" ? 0 : Math.min(delta, GAME_CONFIG.physics.maximumFrameDelta);
    if (budget > 0 && (state.status === "playing" || state.status === "menu")) {
      const trailInterval = GAME_CONFIG.effects.trailInterval * GAME_CONFIG.effects.particleCount / budget;
      pool.trailElapsed += frameDelta;
      if (pool.trailElapsed >= trailInterval) {
        pool.trailElapsed %= trailInterval;
        for (const side of [-1, 1]) {
          const particle = pool.particles[pool.cursor++ % budget];
          particle.x = state.x + Math.cos(state.roll) * side * 0.23;
          particle.y = state.y + Math.sin(state.roll) * side * 0.23;
          particle.z = state.z + 0.86;
          particle.velocityX = 0;
          particle.velocityY = 0;
          particle.velocityZ = 8 + speedPower * 8;
          particle.life = 0.32 + speedPower * 0.12;
          particle.maximumLife = particle.life;
          particle.radius = 0.052;
          particle.trail = true;
          particle.color.set("#ffbd79").multiplyScalar(2.8);
        }
        pool.colorDirty = true;
      }
    }
    for (let index = 0; index < pool.particles.length; index += 1) {
      const particle = pool.particles[index];
      if (index >= budget) {
        particle.life = 0;
        continue;
      }
      particle.life = Math.max(0, particle.life - frameDelta);
      particle.x += particle.velocityX * frameDelta;
      particle.y += particle.velocityY * frameDelta;
      particle.z += particle.velocityZ * frameDelta;
      pool.transform.position.set(particle.x, particle.y, particle.z);
      const radius = particle.radius * particle.life / particle.maximumLife;
      pool.transform.scale.set(radius, radius, radius * (particle.trail ? 4 : 1));
      pool.transform.updateMatrix();
      mesh.current.setMatrixAt(index, pool.transform.matrix);
      if (pool.colorDirty) mesh.current.setColorAt(index, particle.color);
    }
    mesh.current.instanceMatrix.needsUpdate = true;
    if (pool.colorDirty && mesh.current.instanceColor) mesh.current.instanceColor.needsUpdate = true;
    pool.colorDirty = false;

    if (speedLines.current && speedMaterial.current) {
      speedLines.current.count = preset.speedLines;
      speedLines.current.visible = !reducedMotion && speedPower > 0.01 && (state.status === "playing" || state.status === "paused");
      speedMaterial.current.opacity = speedPower * 0.48;
      for (let index = 0; index < preset.speedLines; index += 1) {
        const angle = index * 2.39996;
        const positionZ = 8 - ((index * 13.27 - state.distance * 1.35) % 112 + 112) % 112;
        pool.transform.position.set(Math.cos(angle) * 5.15, Math.sin(angle) * 3.7, positionZ);
        pool.transform.scale.set(0.014, 0.014, 0.8 + speedPower * 3.6);
        pool.transform.updateMatrix();
        speedLines.current.setMatrixAt(index, pool.transform.matrix);
      }
      speedLines.current.instanceMatrix.needsUpdate = true;
    }
  });

  return (
    <group>
      <instancedMesh name="flight-particles" ref={mesh} args={[undefined, undefined, GAME_CONFIG.effects.particleCount]} frustumCulled={false}>
        <octahedronGeometry args={[1, 0]} />
        <meshBasicMaterial toneMapped={false} transparent depthWrite={false} blending={AdditiveBlending} />
      </instancedMesh>
      <instancedMesh name="speed-lines" ref={speedLines} args={[undefined, undefined, QUALITY_PRESETS.high.speedLines]} frustumCulled={false} visible={false}>
        <boxGeometry />
        <meshBasicMaterial ref={speedMaterial} color="#8df8e7" toneMapped={false} transparent opacity={0} depthWrite={false} blending={AdditiveBlending} />
      </instancedMesh>
    </group>
  );
}