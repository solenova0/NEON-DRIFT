"use client";

import { useEffect, useRef, useState } from "react";
import { useThree } from "@react-three/fiber";
import {
  BallCollider,
  CuboidCollider,
  Physics,
  RigidBody,
  interactionGroups,
  useAfterPhysicsStep,
  useBeforePhysicsStep,
  useRapier,
  type RapierCollider,
  type RapierRigidBody,
} from "@react-three/rapier";
import { GAME_CONFIG, OBSTACLE_CAPACITY, ORB_CAPACITY } from "@/game/config";
import { obstacleX } from "@/game/patterns";
import type { FlightSimulation } from "@/game/simulation";
import { publishHud, useGameStore } from "@/store/useGameStore";

const PLAYER_GROUPS = interactionGroups(0, [1, 2]);
const OBSTACLE_GROUPS = interactionGroups(1, [0]);
const ORB_GROUPS = interactionGroups(2, [0]);

function SensorPool({ simulation }: { simulation: FlightSimulation }) {
  const { world, rapier } = useRapier();
  const renderer = useThree((state) => state.gl);
  const player = useRef<RapierRigidBody>(null);
  const playerCollider = useRef<RapierCollider>(null);
  const [handles] = useState(() => ({
    obstacles: Array<RapierRigidBody | null>(OBSTACLE_CAPACITY).fill(null),
    obstacleColliders: Array<RapierCollider | null>(OBSTACLE_CAPACITY).fill(null),
    orbs: Array<RapierRigidBody | null>(ORB_CAPACITY).fill(null),
    generations: new Int32Array(OBSTACLE_CAPACITY).fill(-1),
    orbGenerations: new Int32Array(ORB_CAPACITY).fill(-1),
    contacts: new Map<number, number>(),
    point: { x: 0, y: 0, z: 0 },
  }));

  useEffect(() => {
    useGameStore.setState({ ready: true });
    if (process.env.NODE_ENV === "development") {
      Reflect.set(renderer.domElement, "__physicsWorld", world);
    }
    return simulation.subscribe((event) => {
      if (event.type === "status" && simulation.state.time === 0) handles.contacts.clear();
    });
  }, [simulation, handles, renderer, world]);

  useBeforePhysicsStep(() => {
    simulation.step(GAME_CONFIG.physics.step);
    const state = simulation.state;
    const point = handles.point;
    point.x = state.x;
    point.y = state.y;
    point.z = state.z;
    if (state.time <= GAME_CONFIG.physics.step) player.current?.setTranslation(point, true);
    player.current?.setNextKinematicTranslation(point);

    for (const slot of simulation.pool.obstacles) {
      const body = handles.obstacles[slot.id];
      const collider = handles.obstacleColliders[slot.id];
      if (!body || !collider) continue;
      const positionZ = state.distance - slot.distance;
      const enabled = slot.active && positionZ > -GAME_CONFIG.spawn.visibleDistance &&
        positionZ < GAME_CONFIG.spawn.recycleBehind;
      if (!enabled) {
        if (body.isEnabled()) body.setEnabled(false);
        handles.contacts.delete(slot.id);
        continue;
      }

      point.x = obstacleX(slot, state.time);
      point.y = slot.surface * GAME_CONFIG.flight.surfaceHeight;
      point.z = positionZ;
      const recycled = handles.generations[slot.id] !== slot.generation;
      if (recycled || !body.isEnabled()) {
        handles.contacts.delete(slot.id);
        collider.setHalfExtents(GAME_CONFIG.obstacles[slot.kind]);
        body.setTranslation(point, true);
        body.setEnabled(true);
        handles.generations[slot.id] = slot.generation;
      }
      body.setNextKinematicTranslation(point);
    }

    for (const slot of simulation.pool.orbs) {
      const body = handles.orbs[slot.id];
      if (!body) continue;
      const positionZ = state.distance - slot.distance;
      const enabled = slot.active && !slot.collected &&
        positionZ > -GAME_CONFIG.spawn.visibleDistance && positionZ < GAME_CONFIG.spawn.recycleBehind;
      if (!enabled) {
        if (body.isEnabled()) body.setEnabled(false);
        continue;
      }
      point.x = GAME_CONFIG.flight.lanes[slot.lane];
      point.y = slot.surface * GAME_CONFIG.flight.surfaceHeight;
      point.z = positionZ;
      if (handles.orbGenerations[slot.id] !== slot.generation || !body.isEnabled()) {
        body.setTranslation(point, true);
        body.setEnabled(true);
        handles.orbGenerations[slot.id] = slot.generation;
      }
      body.setNextKinematicTranslation(point);
    }
  });

  useAfterPhysicsStep(() => {
    if (!playerCollider.current) return;
    // Recheck sustained overlaps when flip or hit invulnerability expires.
    for (const [id, generation] of handles.contacts) {
      const slot = simulation.pool.obstacles[id];
      const collider = handles.obstacleColliders[id];
      if (slot.generation !== generation || !collider || !world.intersectionPair(collider, playerCollider.current)) {
        handles.contacts.delete(id);
      } else {
        simulation.hit(slot);
      }
    }
  });

  const collisionTypes = rapier.ActiveCollisionTypes.ALL;
  const playerSize = GAME_CONFIG.flight.playerHalfExtents;

  return (
    <>
      <RigidBody ref={player} name="player" type="kinematicPosition" colliders={false}
        position={[0, -GAME_CONFIG.flight.surfaceHeight, 0]} canSleep={false}>
        <CuboidCollider ref={playerCollider} args={[playerSize.x, playerSize.y, playerSize.z]}
          sensor collisionGroups={PLAYER_GROUPS} activeCollisionTypes={collisionTypes} />
      </RigidBody>
      {simulation.pool.obstacles.map((slot) => (
        <RigidBody key={slot.id} type="kinematicPosition" colliders={false} canSleep={false}
          position={[0, 0, -1000]} ref={(body) => { handles.obstacles[slot.id] = body; }}>
          <CuboidCollider args={[1, 1, 1]} sensor collisionGroups={OBSTACLE_GROUPS}
            activeCollisionTypes={collisionTypes}
            ref={(collider) => { handles.obstacleColliders[slot.id] = collider; }}
            onIntersectionEnter={() => {
              handles.contacts.set(slot.id, slot.generation);
              simulation.hit(slot);
            }}
            onIntersectionExit={() => { handles.contacts.delete(slot.id); }} />
        </RigidBody>
      ))}
      {simulation.pool.orbs.map((slot) => (
        <RigidBody key={slot.id} type="kinematicPosition" colliders={false} canSleep={false}
          position={[0, 0, -1000]} ref={(body) => { handles.orbs[slot.id] = body; }}>
          <BallCollider args={[GAME_CONFIG.orbs.radius]} sensor collisionGroups={ORB_GROUPS}
            activeCollisionTypes={collisionTypes} onIntersectionEnter={() => simulation.collect(slot)} />
        </RigidBody>
      ))}
    </>
  );
}

export function PhysicsWorld({ simulation }: { simulation: FlightSimulation }) {
  const status = useGameStore((state) => state.status);

  useEffect(() => simulation.subscribe(() => publishHud(simulation)), [simulation]);

  return (
    <Physics gravity={[0, 0, 0]} timeStep={GAME_CONFIG.physics.step} interpolate={false}
      updatePriority={-50} paused={status !== "running"}>
      <SensorPool simulation={simulation} />
    </Physics>
  );
}