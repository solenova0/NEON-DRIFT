"use client";

import { useEffect, useRef, useState } from "react";
import { useFrame } from "@react-three/fiber";
import { Color, DynamicDrawUsage, InstancedMesh, Object3D } from "three";
import { GAME_CONFIG, OBSTACLE_CAPACITY, ORB_CAPACITY, type ObstacleKind } from "@/game/config";
import { createFrameGeometry } from "@/game/geometry";
import { obstacleX } from "@/game/patterns";
import type { FlightSimulation } from "@/game/simulation";

const kinds: ObstacleKind[] = ["block", "barrier", "laser"];

export function ObstacleField({ simulation }: { simulation: FlightSimulation }) {
  const meshes = useRef<Record<ObstacleKind, { frame: InstancedMesh | null; body: InstancedMesh | null }>>({
    block: { frame: null, body: null },
    barrier: { frame: null, body: null },
    laser: { frame: null, body: null },
  });
  const orbs = useRef<InstancedMesh>(null);
  const halos = useRef<InstancedMesh>(null);
  const transformRef = useRef(new Object3D());
  const [resources] = useState(() => ({
    frame: createFrameGeometry(),
    colors: {
      block: new Color("#ffae51").multiplyScalar(2.2),
      barrier: new Color("#ff538f").multiplyScalar(2.2),
      laser: new Color("#ff4937").multiplyScalar(2.5),
    },
    energyColor: new Color("#d9ff82").multiplyScalar(2.4),
  }));

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
    for (const slot of pool.obstacles) {
      const positionZ = state.distance - slot.distance;
      const visible = slot.active && positionZ > -GAME_CONFIG.spawn.visibleDistance &&
        positionZ < GAME_CONFIG.spawn.recycleBehind;
      for (const kind of kinds) {
        const mesh = meshes.current[kind];
        if (!mesh.frame || !mesh.body) continue;
        const size = GAME_CONFIG.obstacles[kind];
        transform.position.set(obstacleX(slot, state.time), slot.surface * GAME_CONFIG.flight.surfaceHeight, positionZ);
        transform.rotation.set(0, 0, 0);
        transform.scale.setScalar(0);
        if (visible && slot.kind === kind) transform.scale.set(size.x * 2, size.y * 2, size.z * 2);
        transform.updateMatrix();
        mesh.frame.setMatrixAt(slot.id, transform.matrix);
        transform.scale.multiplyScalar(kind === "laser" ? 0.98 : 0.93);
        transform.updateMatrix();
        mesh.body.setMatrixAt(slot.id, transform.matrix);
      }
    }

    for (const slot of pool.orbs) {
      const positionZ = state.distance - slot.distance;
      const visible = slot.active && !slot.collected && positionZ > -GAME_CONFIG.spawn.visibleDistance &&
        positionZ < GAME_CONFIG.spawn.recycleBehind;
      transform.position.set(GAME_CONFIG.flight.lanes[slot.lane], slot.surface * GAME_CONFIG.flight.surfaceHeight, positionZ);
      transform.rotation.set(state.time * 0.6, state.time * 1.1 + slot.id, Math.PI / 4);
      transform.scale.setScalar(visible ? 1 : 0);
      transform.updateMatrix();
      orbs.current?.setMatrixAt(slot.id, transform.matrix);
      transform.rotation.set(0.2, state.time * 0.8 + slot.id, 0);
      transform.updateMatrix();
      halos.current?.setMatrixAt(slot.id, transform.matrix);
    }

    for (const kind of kinds) {
      const mesh = meshes.current[kind];
      if (mesh.frame) mesh.frame.instanceMatrix.needsUpdate = true;
      if (mesh.body) mesh.body.instanceMatrix.needsUpdate = true;
    }
    if (orbs.current) orbs.current.instanceMatrix.needsUpdate = true;
    if (halos.current) halos.current.instanceMatrix.needsUpdate = true;
  });

  return (
    <group>
      {kinds.map((kind) => (
        <group key={kind}>
          <instancedMesh ref={(mesh) => { meshes.current[kind].frame = mesh; }}
            args={[resources.frame, undefined, OBSTACLE_CAPACITY]} frustumCulled={false}>
            <meshBasicMaterial color={resources.colors[kind]} toneMapped={false} />
          </instancedMesh>
          <instancedMesh ref={(mesh) => { meshes.current[kind].body = mesh; }}
            args={[undefined, undefined, OBSTACLE_CAPACITY]} frustumCulled={false}>
            <boxGeometry />
            <meshStandardMaterial color={kind === "laser" ? "#ff3322" : "#232a2c"}
              emissive={kind === "laser" ? "#ff3322" : "#151417"}
              emissiveIntensity={kind === "laser" ? 1.3 : 0.15}
              transparent={kind === "laser"} opacity={kind === "laser" ? 0.16 : 1}
              depthWrite={kind !== "laser"} metalness={0.65} roughness={0.4} />
          </instancedMesh>
        </group>
      ))}
      <instancedMesh ref={orbs}
        args={[undefined, undefined, ORB_CAPACITY]} frustumCulled={false}>
        <icosahedronGeometry args={[GAME_CONFIG.orbs.radius, 0]} />
        <meshBasicMaterial color={resources.energyColor} toneMapped={false} />
      </instancedMesh>
      <instancedMesh ref={halos}
        args={[undefined, undefined, ORB_CAPACITY]} frustumCulled={false}>
        <torusGeometry args={[0.68, 0.025, 6, 24]} />
        <meshBasicMaterial color={resources.energyColor} toneMapped={false} />
      </instancedMesh>
    </group>
  );
}