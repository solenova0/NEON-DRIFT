"use client";

import { useEffect, useRef, useState } from "react";
import { useFrame } from "@react-three/fiber";
import { Color, DoubleSide, DynamicDrawUsage, InstancedMesh, Object3D } from "three";
import { GAME_CONFIG } from "@/game/config";
import { createTunnelGeometry, TUNNEL_PROFILE } from "@/game/geometry";
import type { FlightSimulation } from "@/game/simulation";
import { selectReducedMotion } from "@/store/gameStore";

const RING_COUNT = 20;
const RING_SPACING = 12;
const BEAM_COUNT = RING_COUNT * TUNNEL_PROFILE.length;

export function Tunnel({ simulation }: { simulation: FlightSimulation }) {
  const ribs = useRef<InstancedMesh>(null);
  const lights = useRef<InstancedMesh>(null);
  const laneMarks = useRef<InstancedMesh>(null);
  const idleDistance = useRef(0);
  const transformRef = useRef(new Object3D());
  const [resources] = useState(() => ({
    walls: createTunnelGeometry(),
    cyan: new Color("#51dbd5").multiplyScalar(2.1),
    orange: new Color("#ff8158").multiplyScalar(2.2),
  }));

  useEffect(() => {
    for (const mesh of [ribs.current, lights.current, laneMarks.current]) {
      mesh?.instanceMatrix.setUsage(DynamicDrawUsage);
    }
    for (let index = 0; index < BEAM_COUNT; index += 1) {
      lights.current?.setColorAt(index, Math.floor(index / 8) % 4 === 0 ? resources.orange : resources.cyan);
    }
    if (lights.current?.instanceColor) lights.current.instanceColor.needsUpdate = true;
  }, [resources]);

  useFrame((_, delta) => {
    if (!ribs.current || !lights.current || !laneMarks.current) return;
    if (simulation.state.status === "menu" && !selectReducedMotion(simulation.store.getState())) {
      idleDistance.current += Math.min(delta, GAME_CONFIG.physics.maximumFrameDelta) * 3.5;
    }
    const distance = simulation.state.status === "menu" ? idleDistance.current : simulation.state.distance;
    const transform = transformRef.current;

    for (let ring = 0; ring < RING_COUNT; ring += 1) {
      const positionZ = 8 + distance % RING_SPACING - ring * RING_SPACING;
      for (let edge = 0; edge < TUNNEL_PROFILE.length; edge += 1) {
        const start = TUNNEL_PROFILE[edge];
        const end = TUNNEL_PROFILE[(edge + 1) % TUNNEL_PROFILE.length];
        const deltaX = end[0] - start[0];
        const deltaY = end[1] - start[1];
        const length = Math.hypot(deltaX, deltaY);
        transform.position.set((start[0] + end[0]) / 2, (start[1] + end[1]) / 2, positionZ);
        transform.rotation.set(0, 0, Math.atan2(deltaY, deltaX));
        transform.scale.set(length, 0.15, 0.28);
        transform.updateMatrix();
        ribs.current.setMatrixAt(ring * 8 + edge, transform.matrix);
        transform.scale.set(length, 0.035, 0.07);
        transform.position.z += 0.17;
        transform.updateMatrix();
        lights.current.setMatrixAt(ring * 8 + edge, transform.matrix);
      }
      for (let surface = 0; surface < 2; surface += 1) {
        for (let lane = 0; lane < GAME_CONFIG.flight.lanes.length; lane += 1) {
          transform.position.set(GAME_CONFIG.flight.lanes[lane], surface === 0 ? -4.18 : 4.18, positionZ - 3);
          transform.rotation.set(0, 0, 0);
          transform.scale.set(0.035, 0.025, 2.6);
          transform.updateMatrix();
          laneMarks.current.setMatrixAt(ring * 6 + surface * 3 + lane, transform.matrix);
        }
      }
    }
    ribs.current.instanceMatrix.needsUpdate = true;
    lights.current.instanceMatrix.needsUpdate = true;
    laneMarks.current.instanceMatrix.needsUpdate = true;
  });

  return (
    <group>
      <mesh geometry={resources.walls}>
        <meshStandardMaterial color="#101619" emissive="#091719" emissiveIntensity={0.4}
          roughness={0.55} metalness={0.65} side={DoubleSide} />
      </mesh>
      <instancedMesh ref={ribs} args={[undefined, undefined, BEAM_COUNT]} frustumCulled={false}>
        <boxGeometry />
        <meshStandardMaterial color="#263438" metalness={0.8} roughness={0.4} />
      </instancedMesh>
      <instancedMesh ref={lights} args={[undefined, undefined, BEAM_COUNT]} frustumCulled={false}>
        <boxGeometry />
        <meshBasicMaterial toneMapped={false} />
      </instancedMesh>
      <instancedMesh ref={laneMarks} args={[undefined, undefined, RING_COUNT * 6]} frustumCulled={false}>
        <boxGeometry />
        <meshBasicMaterial color={resources.cyan} toneMapped={false} />
      </instancedMesh>
      {[-1, 1].flatMap((surface) => [-4.75, 4.75].map((positionX) => (
        <mesh key={`${surface}:${positionX}`} position={[positionX, surface * 4.13, -100]}>
          <boxGeometry args={[0.045, 0.045, 240]} />
          <meshBasicMaterial color={resources.cyan} toneMapped={false} />
        </mesh>
      )))}
      <mesh position={[0, 0, -188]}>
        <torusGeometry args={[2.15, 0.035, 8, 64]} />
        <meshBasicMaterial color={resources.cyan} toneMapped={false} />
      </mesh>
    </group>
  );
}