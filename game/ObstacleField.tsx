"use client";

import { useEffect, useRef, useState } from "react";
import { useFrame } from "@react-three/fiber";
import { Color, DynamicDrawUsage, InstancedMesh, Object3D } from "three";
import { GAME_CONFIG, OBSTACLE_CAPACITY, ORB_CAPACITY, type ObstacleKind } from "@/game/config";
import { createFrameGeometry } from "@/game/geometry";
import { obstacleX } from "@/game/patterns";
import type { FlightSimulation } from "@/game/simulation";
import { THEME } from "@/game/theme";

const kinds: ObstacleKind[] = ["block", "barrier", "laser"];

export function ObstacleField({ simulation }: { simulation: FlightSimulation }) {
  const meshes = useRef<Record<ObstacleKind, { frame: InstancedMesh | null; body: InstancedMesh | null }>>({
    block: { frame: null, body: null },
    barrier: { frame: null, body: null },
    laser: { frame: null, body: null },
  });
  const orbs = useRef<InstancedMesh>(null);
  const halos = useRef<InstancedMesh>(null);
  const visibleCounts = useRef<Record<ObstacleKind, number>>({ block: 0, barrier: 0, laser: 0 });
  const transformRef = useRef(new Object3D());
  const [resources] = useState(() => ({
    frame: createFrameGeometry(),
    colors: {
      block: new Color(THEME.obstacles.block).multiplyScalar(THEME.glow.obstacle),
      barrier: new Color(THEME.obstacles.barrier).multiplyScalar(THEME.glow.obstacle),
      laser: new Color(THEME.obstacles.laser).multiplyScalar(THEME.glow.obstacle),
    },
    energyColor: new Color(THEME.palette.orb).multiplyScalar(THEME.glow.orb),
  }));

  useEffect(() => () => resources.frame.dispose(), [resources]);

  useEffect(() => {
    for (const kind of kinds) {
      meshes.current[kind].frame?.instanceMatrix.setUsage(DynamicDrawUsage);
      meshes.current[kind].body?.instanceMatrix.setUsage(DynamicDrawUsage);
    }
    orbs.current?.instanceMatrix.setUsage(DynamicDrawUsage);
    halos.current?.instanceMatrix.setUsage(DynamicDrawUsage);
  }, []);

  useFrame(() => {
    const { state, pool } = simulation;
    const transform = transformRef.current;
    const counts = visibleCounts.current;
    for (const kind of kinds) counts[kind] = 0;
    for (const slot of pool.obstacles) {
      const positionZ = state.distance - slot.distance;
      const visible = slot.active && positionZ > -GAME_CONFIG.spawn.visibleDistance &&
        positionZ < GAME_CONFIG.spawn.recycleBehind;
      if (!visible) continue;
      const mesh = meshes.current[slot.kind];
      if (!mesh.frame || !mesh.body) continue;
      const size = GAME_CONFIG.obstacles[slot.kind];
      const index = counts[slot.kind]++;
      transform.position.set(obstacleX(slot, state.time), slot.surface * GAME_CONFIG.flight.surfaceHeight, positionZ);
      transform.rotation.set(0, 0, 0);
      transform.scale.set(size.x * 2, size.y * 2, size.z * 2);
      transform.updateMatrix();
      mesh.frame.setMatrixAt(index, transform.matrix);
      transform.scale.multiplyScalar(slot.kind === "laser" ? 0.98 : 0.93);
      transform.updateMatrix();
      mesh.body.setMatrixAt(index, transform.matrix);
    }

    let orbCount = 0;
    for (const slot of pool.orbs) {
      const positionZ = state.distance - slot.distance;
      const visible = slot.active && !slot.collected && positionZ > -GAME_CONFIG.spawn.visibleDistance &&
        positionZ < GAME_CONFIG.spawn.recycleBehind;
      if (!visible) continue;
      transform.position.set(GAME_CONFIG.flight.lanes[slot.lane], slot.surface * GAME_CONFIG.flight.surfaceHeight, positionZ);
      transform.rotation.set(state.time * 0.6, state.time * 1.1 + slot.id, Math.PI / 4);
      transform.scale.setScalar(1);
      transform.updateMatrix();
      orbs.current?.setMatrixAt(orbCount, transform.matrix);
      transform.rotation.set(0.2, state.time * 0.8 + slot.id, 0);
      transform.updateMatrix();
      halos.current?.setMatrixAt(orbCount, transform.matrix);
      orbCount += 1;
    }

    for (const kind of kinds) {
      const mesh = meshes.current[kind];
      if (mesh.frame) {
        mesh.frame.count = counts[kind];
        mesh.frame.instanceMatrix.needsUpdate = true;
      }
      if (mesh.body) {
        mesh.body.count = counts[kind];
        mesh.body.instanceMatrix.needsUpdate = true;
      }
    }
    if (orbs.current) {
      orbs.current.count = orbCount;
      orbs.current.instanceMatrix.needsUpdate = true;
    }
    if (halos.current) {
      halos.current.count = orbCount;
      halos.current.instanceMatrix.needsUpdate = true;
    }
  });

  return (
    <group>
      {kinds.map((kind) => (
        <group key={kind}>
          <instancedMesh name={`${kind}-frames`} ref={(mesh) => { meshes.current[kind].frame = mesh; }}
            args={[resources.frame, undefined, OBSTACLE_CAPACITY]} frustumCulled={false}>
            <meshBasicMaterial color={resources.colors[kind]} toneMapped={false} />
          </instancedMesh>
          <instancedMesh name={`${kind}-bodies`} ref={(mesh) => { meshes.current[kind].body = mesh; }}
            args={[undefined, undefined, OBSTACLE_CAPACITY]} frustumCulled={false}>
            <boxGeometry />
            <meshStandardMaterial color={kind === "laser" ? THEME.obstacles.laser : THEME.palette.metal}
              emissive={THEME.obstacles[kind]}
              emissiveIntensity={kind === "laser" ? THEME.glow.laser : THEME.glow.wall}
              transparent={kind === "laser"} opacity={kind === "laser" ? 0.28 : 1}
              depthWrite={kind !== "laser"} metalness={0.65} roughness={0.4} />
          </instancedMesh>
        </group>
      ))}
      <instancedMesh name="energy-orbs" ref={orbs}
        args={[undefined, undefined, ORB_CAPACITY]} frustumCulled={false}>
        <icosahedronGeometry args={[GAME_CONFIG.orbs.radius, 0]} />
        <meshBasicMaterial color={resources.energyColor} toneMapped={false} />
      </instancedMesh>
      <instancedMesh name="energy-halos" ref={halos}
        args={[undefined, undefined, ORB_CAPACITY]} frustumCulled={false}>
        <torusGeometry args={[0.68, 0.025, 6, 24]} />
        <meshBasicMaterial color={resources.energyColor} toneMapped={false} />
      </instancedMesh>
    </group>
  );
}