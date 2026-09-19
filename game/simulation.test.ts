import assert from "node:assert/strict";
import test from "node:test";
import { GAME_CONFIG } from "./config.ts";
import { FlightSimulation, type GameEvent } from "./simulation.ts";

function advance(simulation: FlightSimulation, seconds: number) {
  const steps = Math.round(seconds / GAME_CONFIG.physics.step);
  for (let step = 0; step < steps; step += 1) simulation.step(GAME_CONFIG.physics.step);
}

test("a flip makes a 0.3 second arc and rolls exactly 180 degrees", () => {
  const simulation = new FlightSimulation();
  assert.equal(simulation.requestFlip(), false);
  simulation.start();
  assert.equal(simulation.requestFlip(), true);
  advance(simulation, 0.15);
  assert.ok(Math.abs(simulation.state.y) < 1e-8);
  assert.ok(Math.abs(simulation.state.roll - Math.PI / 2) < 1e-8);
  assert.ok(Math.abs(simulation.state.z + GAME_CONFIG.flip.forwardArc) < 1e-8);
  assert.equal(simulation.invulnerable, true);
  advance(simulation, 0.15);
  assert.equal(simulation.state.y, GAME_CONFIG.flight.surfaceHeight);
  assert.equal(simulation.state.roll, Math.PI);
  assert.equal(simulation.state.z, 0);
  assert.equal(simulation.invulnerable, false);
  assert.equal(simulation.requestFlip(), false);
  advance(simulation, 0.45);
  assert.equal(simulation.requestFlip(), true);
  advance(simulation, 0.3);
  assert.equal(simulation.state.y, -GAME_CONFIG.flight.surfaceHeight);
});

test("pause freezes the world, flip animation, and cooldown", () => {
  const simulation = new FlightSimulation();
  simulation.start();
  simulation.requestFlip();
  advance(simulation, 0.1);
  simulation.pause();
  const paused = { ...simulation.state };
  advance(simulation, 2);
  assert.deepEqual(simulation.state, paused);
  assert.equal(simulation.requestFlip(), false);
  assert.equal(simulation.moveLane(1), false);
  simulation.togglePause();
  advance(simulation, 0.2);
  assert.equal(simulation.state.flipping, false);
});

test("flip invulnerability prevents damage, while later contact emits one hit", () => {
  const simulation = new FlightSimulation();
  const events: GameEvent[] = [];
  simulation.subscribe((event) => events.push(event));
  simulation.start();
  const obstacle = simulation.pool.obstacles.find((slot) => slot.active)!;
  simulation.requestFlip();
  assert.equal(simulation.hit(obstacle), false);
  advance(simulation, 0.3);
  assert.equal(simulation.hit(obstacle), true);
  assert.equal(simulation.state.shield, 75);
  assert.equal(simulation.hit(obstacle), false);
  const another = simulation.pool.obstacles.find((slot) => slot.active && !slot.spent)!;
  assert.equal(simulation.hit(another), false);
  assert.equal(events.filter((event) => event.type === "hit").length, 1);
});

test("four separated hits end the run and restart reuses the same pool", () => {
  const simulation = new FlightSimulation();
  simulation.start();
  const pool = simulation.pool;
  const slot = pool.obstacles[0];
  for (let hit = 0; hit < 4; hit += 1) {
    const obstacle = pool.obstacles.find((candidate) => candidate.active && !candidate.spent)!;
    assert.equal(simulation.hit(obstacle), true);
    advance(simulation, 1.2);
  }
  assert.equal(simulation.state.status, "gameover");
  assert.equal(simulation.state.shield, 0);
  simulation.start();
  assert.equal(simulation.state.status, "running");
  assert.equal(simulation.state.shield, 100);
  assert.equal(simulation.state.distance, 0);
  assert.equal(simulation.pool, pool);
  assert.equal(simulation.pool.obstacles[0], slot);
});

test("orbs emit exactly one collect event per generation", () => {
  const simulation = new FlightSimulation();
  const events: GameEvent[] = [];
  simulation.subscribe((event) => events.push(event));
  simulation.start();
  const orb = simulation.pool.orbs[0];
  assert.equal(simulation.collect(orb), true);
  assert.equal(simulation.collect(orb), false);
  assert.equal(simulation.state.energy, GAME_CONFIG.orbs.energy);
  assert.equal(events.filter((event) => event.type === "collect").length, 1);
});

test("lateral controls stay screen-relative after the camera flips", () => {
  const simulation = new FlightSimulation();
  simulation.start();
  simulation.moveLane(-1);
  advance(simulation, 0.25);
  assert.equal(simulation.state.x, GAME_CONFIG.flight.lanes[0]);
  assert.equal(simulation.moveLane(-1), false);
  simulation.requestFlip();
  advance(simulation, 0.3);
  assert.equal(simulation.moveLane(-1), true);
  advance(simulation, 0.25);
  assert.equal(simulation.state.x, GAME_CONFIG.flight.lanes[1]);
});