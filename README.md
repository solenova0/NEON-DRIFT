# NEON DRIFT

A full-bleed 3D gravity runner through a recycled neon conduit.

**Current checkpoint: Phase 4.** Animated menus, pause/results count-ups, a new-record celebration, a local top-five leaderboard, persistent settings, real loading progress, and mobile visual polish are implemented. Audio playback and the final performance pass remain for Phase 5. Volume preferences are saved now; the audio system is still in standby.

## Install and Run

Use Node.js 22.18+ (Node.js 24 recommended), npm, and a WebGL2-capable browser with hardware acceleration.

```bash
npm ci
npm run dev
```

Open the local URL printed by Next.js. The default port is 3000; Next.js selects an available port if it is occupied.

```bash
npm test
npm run typecheck
npm run lint
npm run build
npm start
```

For another device on your network, run `npm run dev -- --hostname 0.0.0.0` and open your computer's LAN address with the printed port. No API keys or external asset services are required; fonts, geometry, and physics are served locally.

## Controls

| Action | Keyboard | Touch |
| --- | --- | --- |
| Change lane | A / D or left / right arrow | Swipe left / right, or arrow buttons |
| Flip gravity | Space, W, or up arrow | Swipe up, or gravity button |
| Pause / resume | Esc or P | Pause / resume button |
| Launch / retry / resume | Enter | Main action button |
| Return to menu | Focus and activate the home button | Home icon or NEON DRIFT wordmark |
| Close settings / leaderboard | Esc or Back | Back, close icon, or backdrop |

Steering remains screen-relative on the ceiling. A flip takes 0.3 seconds, grants invulnerability during transit, and rotates the camera 180 degrees. Reduced motion uses an instantaneous camera orientation change instead of a continuous roll. Its start-to-start cooldown is 0.72 seconds. Holding a key does not queue repeated actions. Switching tabs or losing browser focus pauses the run. Native dialogs contain keyboard focus and prevent flight input while open; Escape closes the panel before it can resume a paused run.

## Features

- Three obstacle types: amber static blocks, pink sweeping barriers, and red laser gates on the floor or ceiling.
- Seeded four-row chunks, generated ahead and recycled behind the craft. Full-surface laser rows require gravity flips.
- Lime energy orbs follow the reserved survivable route and award 10 energy exactly once per pickup.
- Six pooled chunks: 144 obstacle slots, 24 orb slots, and one player sensor. Meshes, collider bodies, and slot objects are reused, including on restart.
- Fixed-step Rapier sensor collisions at 60 Hz. Hits cost 25 shield and trigger camera shake, a screen flash, and a pooled particle burst.
- A 1.15-second damage recovery window prevents overlapping obstacles from draining the shield instantly. Four separated hits end a run.
- Smooth lane changes, a forward-arching flip, speed-driven FOV, custom craft geometry, emissive tunnel ribs, and pooled exhaust particles.
- Explicit low/medium/high graphics presets for postprocessing, resolution limits, particles, and speed lines. Phones initially use medium; a saved preference takes precedence.
- Responsive telemetry, labeled controls, and animated launch/pause/restart states. No React state updates in the per-frame movement loop; telemetry publishes at 10 Hz.
- Animated score, a pulsing combo badge, shield health colors, speed readout, and a flip-cooldown ring, styled with Tailwind and Framer Motion. Instruments use narrow Zustand selectors independently of the scene.
- Distance points and banked orb bonuses, with a consecutive-orb multiplier up to x5. Hits break the combo without removing earned points.
- Smooth time-based speed and spawn-density curves, with every pooled row's density sampled at its expected arrival time.
- A localStorage personal best with validated reads, throttled writes, cross-tab merging, and an in-memory fallback when browser storage is unavailable.
- A slow-moving menu tunnel, drifting camera, breathing neon title, and animated Play, Settings, and Leaderboard controls.
- Pause and game-over score count-ups, a brief new-high-score celebration, and immediate Retry/Menu actions without recreating the scene or physics world.
- A local top-five completed-run leaderboard, sorted by score, with distance and peak combo. Abandoned runs are not submitted; the continuously tracked personal best can still include them.
- A native settings dialog with quality controls, master/music/effects sliders, and a reduced-motion switch that follows the system preference until overridden.
- Real drei loading progress for scene-module loading and physics-sensor readiness. Cached loads may finish almost immediately; no timed or simulated percentage is used.
- CSS palette tokens, notch/home-indicator safe areas, portrait/landscape dialogs, peripheral speed lines, and speed-dependent exhaust trails.

## Architecture

```text
app/                   App Router entry, metadata, and global styles
components/            Client shell, selector-based HUD, animated counters/menus
game/config.ts         Gameplay tuning and pool capacities
game/difficulty.ts     Smooth speed/density curves and distance integration
game/patterns.ts        Seeded generator, validator, and chunk recycling
game/simulation.ts      Deterministic movement and the store/physics bridge
game/PhysicsWorld.tsx   Fixed Rapier sensor pool and overlap resolution
game/GameScene.tsx      Three.js scene and preset-controlled postprocessing
game/                  Instanced tunnel, obstacles, craft, and effects
hooks/                 Input, high-score and profile persistence lifecycles
store/gameStore.ts     Lifecycle, scoring, settings, panels, and local records
store/useGameStore.ts  Per-game provider and selector-only React hook
store/highScore.ts     Guarded storage adapter with session fallback
game/*.test.ts         Flight, difficulty, and generation regression tests
store/*.test.ts        Lifecycle, scoring, and storage regression tests
```

Tech stack: Next.js App Router, TypeScript, React Three Fiber, drei, react-three/postprocessing, react-three/rapier, Zustand, Tailwind CSS, Framer Motion, and Lucide. All scene assets are custom procedural geometry.

Each game instance has one Zustand store. It owns `menu`, `playing`, `paused`, and `gameOver`, along with shield, scoring, combo, and the record. Typed actions reject invalid transitions; starting requires the physics scene to be ready. Start/retry and return-to-menu reset movement and pooled slots through the simulation's store subscription. The simulation reads lifecycle and shield values from that same store rather than maintaining a second state machine.

Rapier advances mutable movement and sensor positions together at 60 Hz. UI telemetry is published at 10 Hz and synchronously before pickups, hits, flips, and pauses, so the last fraction of a run is included in its score. The scene never subscribes to score, combo, or high score; the physics wrapper selects lifecycle status, and the scene selects only quality and reduced motion. Individual HUD instruments subscribe to the values they display. Counter animation uses motion values instead of per-frame React state.

Store actions contain no browser storage access or timers. Persistence runs in separate client hooks with cleanup, leaving lifecycle, scoring, preference validation, and leaderboard ranking testable without a browser. Completing a run records it once within the same store transition; retry reuses the existing pool immediately, independently of overlay exit animations.

The scene uses procedural geometry rather than downloaded models/textures. Its loader registers actual scene-code loading and completed Rapier sensor initialization with Three's `DefaultLoadingManager`; drei's `useProgress` reads completed work items from that manager. The loading screen blocks HUD input until the physics world is ready, then fades away. Its percentage measures completed initialization tasks, not estimated download bytes.

## Scoring and Records

- Distance earns 1 point per meter. Total score is the integer distance score plus accumulated orb bonuses; the combo does not retroactively multiply distance or earlier points.
- Each orb awards `100 * combo` bonus points and 10 energy. Every third consecutive pickup increases the combo before awarding that pickup, up to x5. The first three bonuses are 100, 100, and 200; the sixth orb awards 300.
- A damaging hit resets combo to x1 and the streak to zero. Existing score is kept. An ignored hit during invulnerability does not break the combo. Missing an orb does not break it.
- Pause freezes movement, score, difficulty, and cooldown. Resume continues the same run. Retry/menu reset run values but preserve the personal best.
- The personal best uses `neon-drift.high-score.v1` in localStorage. Writes are throttled to once per second and flushed on pause, game over, menu, page hide, or unmount. Corrupt, negative, fractional, or unsafe values are ignored, and records never decrease.
- If localStorage is blocked or full, gameplay continues with an in-memory record for the current session. Such a fallback cannot survive closing or reloading the page.
- Settings and completed runs use `neon-drift.profile.v1`. Invalid preference values and records are rejected, volume values are clamped, and only the top five valid results are retained. Preference writes are debounced; completed results are written immediately. Storage failures leave the current page's preferences and records usable in memory.

## Graphics and Motion

| Preset | Particle draw budget | Speed lines | DPR cap | Postprocessing |
| --- | --- | --- | --- | --- |
| Low | 16 | 0 | 1 | Off |
| Medium | 40 | 20 | 1.25 | Lighter bloom and vignette |
| High | 72 | 36 | 1.5 | Full bloom, vignette, subtle chromatic aberration |

Effects reuse fixed instance buffers instead of allocating entities when presets change. Speed lines fade in above 29 m/s; exhaust stretches and the FOV widens smoothly at high speed. The menu tunnel moves at 3.5 m/s with a gentle camera drift. A pause freezes the camera and flight effects as well as the simulation.

Reduced motion disables menu drift/travel, neon breathing, decorative particles, speed lines, FOV changes, damage shake/flash, pulsing and count-up animations. Gameplay movement and hit rules are unchanged; camera orientation snaps at the flip midpoint so ceiling steering stays screen-relative without a spinning view. Reset settings restores automatic system motion preference. Audio slider values are persisted for Phase 5 and do not produce sound at this checkpoint.

The HUD and menus share CSS palette and safe-area variables in [app/globals.css](app/globals.css). Short portrait menus hide duplicate live instruments; they reappear during play. Landscape panels use two columns where practical and scroll internally when height is limited.

## Fairness and Tuning

Edit [game/config.ts](game/config.ts) for speed limits, difficulty time constant, density limits, scoring/combo rules, persistence settings, row spacing (spawn rate), chunk capacity, hitboxes, barrier travel, flip timing, shield, orb values, camera, effects, and input thresholds.

Difficulty uses `1 - exp(-elapsed / 90)` to approach 40 m/s from 22 m/s and a spawn-density probability of 0.86 from 0.38. There are no level thresholds or speed jumps. Distance is the analytic integral of that speed curve. Each row uses the curve at its expected arrival time, not its chunk's generation time, so look-ahead buffering does not introduce density tiers or change already-visible obstacles.

The generator first reserves a route from the previous chunk's exit. The independent validator searches all six lane/surface cells at each row, using maximum speed, lateral travel time, flip duration, cooldown history, reaction time, and hitbox clearance. Moving barriers reserve their entire swept volume; laser gates are treated as continuously dangerous. Neither the validator nor the reserved route relies on invulnerability.

Every chunk is validated before use. If validation fails, the same pooled chunk becomes an unobstructed recovery corridor. Chunks carry route state across boundaries rather than being checked in isolation. The guarantee is a reachable route from the reserved entry, not survival after any arbitrary player decision. Orbs mark that route.

## Phase 4 Test Checklist

1. Reload with the browser cache disabled. The loading percentage should follow real initialization and disappear when the scene is ready. Play must not activate behind the loader; Retry must not show it again.
2. Leave the main menu idle. The tunnel moves slowly, the camera drifts, and the title glows gently. Hover/press Play, Settings, and Leaderboard and check their transitions without a layout shift.
3. Pause a scored run. The current score counts up, and motion remains frozen. Resume preserves it; Retry resets immediately. On game over, verify the final count-up and new-high-score celebration only when the previous best is exceeded. Menu returns without reloading.
4. Finish several runs and open Leaderboard. Check score ranking, distance, peak combo, the top-five limit, and reload persistence. Only completed runs belong in this local list.
5. Switch among Low, Medium, and High in Settings. Observe bloom and particle-density changes without restarting. Set volume levels, close/reopen, and reload to verify they persist. Audio remains silent until Phase 5.
6. Enable Reduced motion. Menu movement, glow breathing, particles, shake, FOV widening, and count-ups stop. Play and flip: the rules stay unchanged and the camera switches orientation without a continuous spin. Reset settings should follow the OS motion preference again.
7. Test settings and leaderboard with Tab, arrows, Enter/Space, Escape, backdrop click, and touch. Focus stays inside the panel, sliders do not steer, Escape closes the panel, and focus returns to its opener.
8. On a phone, swipe left/right/up, then use Pause and the on-screen controls. Test portrait and landscape, a new-record result screen, and a notched/home-indicator layout. Panels may scroll internally; the page and live play area should not scroll.
9. In an isolated browser context, block storage or corrupt the profile key. Menus, preferences, scoring, results, and retry should still work without throwing. The blocked-storage fallback is page-session only.

Phase 4 verification includes 28 model tests; real 0/50/100 loading milestones; quality draw budgets and DPR limits; a live high-speed FOV/line check; system/explicit reduced motion; focus containment; denied/corrupt storage; settings/results reload persistence; and identical scene, physics-world, and pool identities after Retry. Browser layout checks include 320x568, 375x667, 390x844, 640x360, 844x390, and 1440x900, with simulated safe-area insets and record celebrations. Frame-spaced native touch gestures verify swipe-then-pause behavior. Canvas-pixel checks confirm visible desktop/mobile scenes.

## Scoring Regression Checklist

1. Launch from the menu, pause/resume with Esc, return to the menu, and restart after game over. Pause must preserve the run; retry/menu must reset score, combo, shield, time, and gravity while retaining BEST.
2. Fly without collecting orbs. RUN SCORE should track whole meters with a smooth counter animation. Pick up three consecutive orbs: their bonuses should be 100, 100, and 200, and x2 should pulse on the third. Continue to x5; it must not exceed that cap.
3. Take a hit while the combo is above x1. The combo and progress marks reset, but accumulated points remain. At 50% shield the bar turns amber; at 25% it turns red. A hit ignored during a flip must not reset the combo.
4. Flip and watch the cooldown ring empty/refill. Pause mid-flip: score, speed, and ring progress must stay frozen until resumed. The flip button enables only after recharge.
5. Continue a longer run. Speed and obstacle density should rise gradually with no chunk-boundary jump. The reserved safe route must remain valid even as the tunnel gets denser.
6. Set a best score, pause or finish, then reload. BEST remains, while the run starts at the menu with zero score. A shorter subsequent run must not lower the record.
7. In a temporary/private test context, block localStorage or place invalid JSON under the record key. The game must still launch, collect points, pause, and restart without an error. Blocked storage retains a best only until that page is closed or reloaded.
8. Check portrait and landscape on a phone, including pause and game-over screens. Score, combo, shield, speed, cooldown, and controls must remain readable and separated; motion effects must not resize the HUD or stutter the 3D scene.

The Phase 3 baseline included 24 model tests, a maximum-speed fairness sweep of 3,072 seeded chunks, continuous difficulty sampling over ten simulated minutes, corrupt/denied/quota-limited storage cases, and live Rapier pickup/hit checks. Its browser render audit observed 17 score changes and zero commits in the React Three Fiber renderer. Reload persistence, blocked-storage gameplay, and compact portrait/landscape layouts were checked in the browser.

## Flight Regression Checklist

1. Launch a run. A/D, arrow keys, horizontal swipes, and the arrow buttons move through three lanes without leaving the tunnel.
2. Press Space or swipe up. The craft arcs to the other surface in 0.3 seconds; the camera rolls 180 degrees. An immediate second flip must wait for the gravity charge to refill. Repeat after clicking a steering button.
3. Follow the lime orbs. Look for amber blocks, pink barriers sweeping sideways, and red laser gates across one surface. Flip before a full-surface gate; continue through several chunk boundaries.
4. Hit each obstacle type. Shield goes 100 -> 75 -> 50 -> 25 -> 0 on separated hits, with flash, shake, and particles. A single overlap must not drain multiple segments.
5. Flip through a nearby obstacle in transit. Shield must not drop during the arc; colliding after landing can still cause damage. Pause mid-flip and verify the arc and cooldown freeze until resumed.
6. Collect an orb. It disappears, emits a lime burst, and adds exactly 10 energy. Passing through its old position must not collect it again.
7. Lose all shield and select Retry. Shield, energy, distance, gravity, obstacles, and pickup availability reset without duplicate meshes or sensors.
8. Test portrait and landscape on a phone. Swipe up must not scroll the page. Steering must match screen direction after flipping. HUD and buttons must stay visible and separated.

Model checks cover 3,072 seeded chunks, blocked-route rejection, barrier sweep safety, cross-chunk flip timing, pool identity, exact flip duration, pause, invulnerability, event deduplication, game over, restart, and inverted steering.

Phase 2 browser verification exercised actual Rapier overlaps for all obstacle types at maximum speed, collection, flip protection, touch gestures, and restart. Its 52-chunk accelerated recycling check retained the same 25 mesh identities, 24 geometries, and 169 rigid bodies/colliders. Phase 4 adds a fixed speed-line mesh and retains all 169 physics bodies across preset changes and retries. Actual frame rate depends on the device and GPU; physical-device performance profiling remains for Phase 5.

## What I Learned

- An empty lane alone is not a fairness guarantee. Routes need traversal time, cooldown history, swept moving obstacles, and cross-chunk entry state.
- Pooled Rapier sensors can remain intersecting across restarts or invulnerability expiry. Querying current intersection pairs avoids missed hits from relying only on an enter callback.
- Refs and a deterministic simulation keep mutable renderer handles and per-frame movement out of React state.
- Rolling the world changes left and right. Screen-relative steering and genuine touch-event tests catch issues that keyboard-only checks miss.
- A lifecycle store should be authoritative, not a lagging mirror of another state machine. Keeping motion outside React still allows status, shield, scoring, and persistence to share one source of truth.
- Smooth difficulty must account for look-ahead spawning. Sampling per-row arrival time avoids abrupt density bands when pooled chunks recycle.
- Persistence is optional infrastructure: validation, isolated side effects, and a monotonic in-memory fallback keep storage failures out of gameplay.
- Real progress can track completed initialization tasks even when all visual assets are procedural; a timer cannot prove that a physics world is ready.
- Result celebrations and device safe areas belong in responsive tests, not just the empty menu. Explicit grid placement avoids accidental rows when optional content appears.
