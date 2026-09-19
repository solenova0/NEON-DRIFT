"use client";

import { useEffect, useRef, useState } from "react";
import { motion, useAnimationControls } from "framer-motion";
import { ArrowLeft, ArrowRight, ArrowUpDown, Crosshair, Gauge, Maximize, Minimize, Pause, Play, Shield, Trophy, Volume2, VolumeX, Zap } from "lucide-react";
import { AnimatedScore, formatScore } from "@/components/AnimatedScore";
import { RunMenus } from "@/components/RunMenus";
import { GAME_CONFIG } from "@/game/config";
import type { FlightSimulation } from "@/game/simulation";
import { selectReducedMotion } from "@/store/gameStore";
import { useGameStore } from "@/store/useGameStore";
import { comboColor } from "@/game/theme";

const glassSurface = "rounded-md border border-[var(--line)] bg-[var(--glass)] shadow-[var(--glass-shadow)] backdrop-blur-xl";

function ComboBadge() {
  const combo = useGameStore((state) => state.combo);
  const streak = useGameStore((state) => state.orbStreak);
  const previousCombo = useRef(combo);
  const controls = useAnimationControls();
  const reducedMotion = useGameStore(selectReducedMotion);

  useEffect(() => {
    if (combo > previousCombo.current && !reducedMotion) {
      void controls.start({ scale: [1, 1.2, 1], transition: { duration: 0.38 } });
    }
    previousCombo.current = combo;
  }, [combo, controls, reducedMotion]);

  const progress = combo === GAME_CONFIG.scoring.maximumCombo
    ? GAME_CONFIG.scoring.orbsPerCombo : streak % GAME_CONFIG.scoring.orbsPerCombo;

  return (
    <motion.div animate={controls} className="combo-badge" data-testid="combo-badge" data-combo={combo}
      style={{ color: comboColor(combo) }} aria-label={`Combo multiplier ${combo}`}>
      <span className="combo-value">x{combo}</span>
      <div className="flex justify-center gap-1" aria-hidden="true">
        {Array.from({ length: GAME_CONFIG.scoring.orbsPerCombo }, (_, index) => (
          <span key={index} className={`h-0.5 w-2 ${index < progress ? "bg-[var(--lime)]" : "bg-white/15"}`} />
        ))}
      </div>
    </motion.div>
  );
}

function ScoreInstrument() {
  const score = useGameStore((state) => state.score);
  const highScore = useGameStore((state) => state.highScore);

  return (
    <div className={`score-instrument ${glassSurface}`}>
      <div className="flex items-start justify-between gap-2">
        <div className="min-w-0">
          <span className="instrument-label">RUN SCORE</span>
          <div className="score-number"><AnimatedScore value={score} /></div>
        </div>
        <ComboBadge />
      </div>
      <div className="record-line flex items-center gap-1.5 border-t border-white/10 pt-2">
        <Trophy size={10} className="shrink-0 text-[var(--orange)]" /><span>BEST</span>
        <span className="ml-auto tabular-nums text-[var(--paper)]" data-testid="high-score" data-value={highScore}
          title={highScore.toLocaleString("en-US")}>{formatScore(highScore)}</span>
      </div>
    </div>
  );
}

function EnergyReadout() {
  const energy = useGameStore((state) => state.energy);
  return (
    <div className="energy-readout flex items-center gap-1.5 border-t border-white/10 pt-2">
      <Zap size={11} className="shrink-0 text-[var(--lime)]" /><span>ENERGY</span>
      <span className="ml-auto tabular-nums text-[var(--lime)]" data-testid="energy-value">{formatScore(energy)}</span>
    </div>
  );
}

function ShieldInstrument() {
  const shield = useGameStore((state) => state.shield);
  const reducedMotion = useGameStore(selectReducedMotion);
  const level = shield <= 25 ? "critical" : shield <= 50 ? "warning" : "stable";
  const color = level === "critical" ? "var(--danger)" : level === "warning" ? "var(--warning)" : "var(--cyan)";

  return (
    <div className={`shield-instrument ${glassSurface}`} data-shield-state={level}>
      <div className="instrument-label"><Shield size={13} style={{ color }} />
        <span>SHIELD<span className="shield-label-detail"> INTEGRITY</span></span>
        <strong data-testid="shield-value" style={{ color }}>{shield}<span>%</span></strong>
      </div>
      <div className="mt-3 h-1.5 overflow-hidden rounded-sm bg-white/10" role="progressbar"
        aria-label="Shield integrity" aria-valuemin={0} aria-valuemax={100} aria-valuenow={shield}>
        <motion.div className="h-full w-full origin-left" initial={false}
          animate={{ scaleX: shield / GAME_CONFIG.shield.maximum, backgroundColor: color }}
          transition={{ duration: reducedMotion ? 0 : 0.25 }} />
      </div>
      <div className="shield-status" style={{ color }}>{level === "critical" ? "CRITICAL" : level === "warning" ? "CAUTION" : "SYSTEM NOMINAL"}</div>
      <EnergyReadout />
    </div>
  );
}

function FullscreenButton() {
  const [fullscreen, setFullscreen] = useState(false);
  useEffect(() => {
    const update = () => setFullscreen(Boolean(document.fullscreenElement));
    document.addEventListener("fullscreenchange", update);
    return () => document.removeEventListener("fullscreenchange", update);
  }, []);

  async function toggleFullscreen() {
    try {
      if (document.fullscreenElement) await document.exitFullscreen();
      else await document.documentElement.requestFullscreen();
    } catch {
      setFullscreen(false);
    }
  }

  return (
    <button className="icon-button fullscreen-button" type="button" onClick={toggleFullscreen}
      aria-label={fullscreen ? "Exit fullscreen" : "Enter fullscreen"} title={fullscreen ? "Exit fullscreen" : "Enter fullscreen"}>
      {fullscreen ? <Minimize size={18} /> : <Maximize size={18} />}
    </button>
  );
}

function MuteButton() {
  const muted = useGameStore((state) => state.settings.muted);
  const updateSettings = useGameStore((state) => state.updateSettings);
  return (
    <button type="button" className="icon-button" aria-label={muted ? "Unmute audio" : "Mute audio"}
      aria-pressed={muted} title={muted ? "Unmute audio (M)" : "Mute audio (M)"}
      onClick={() => updateSettings({ muted: !muted })}>
      {muted ? <VolumeX size={18} /> : <Volume2 size={18} />}
    </button>
  );
}

function FlightHeader({ simulation }: { simulation: FlightSimulation }) {
  const status = useGameStore((state) => state.status);
  return (
    <header className="flight-header">
      <button type="button" className="wordmark border-0 bg-transparent p-0" onClick={() => simulation.returnToMenu()} aria-label="Neon Drift home" title="Return to menu">
        <span className="brand-symbol"><Zap size={22} fill="currentColor" /></span>
        <span>NEON<span className="wordmark-accent">DRIFT</span></span>
      </button>
      <div className="sector-label"><span className="status-dot" /> THE CONDUIT <span className="sector-divider">/</span> SECTOR 01</div>
      <div className="header-actions">
        <span className="build-label">FLIGHT SYSTEM 06</span>
        <MuteButton />
        <FullscreenButton />
        <button type="button" className="icon-button" disabled={status !== "playing" && status !== "paused"}
          onClick={() => simulation.togglePause()} title={status === "paused" ? "Resume (Esc)" : "Pause (Esc)"}
          aria-label={status === "paused" ? "Resume flight" : "Pause flight"}>
          {status === "paused" ? <Play size={18} /> : <Pause size={18} />}
        </button>
      </div>
    </header>
  );
}

function GravityInstrument({ simulation }: { simulation: FlightSimulation }) {
  const active = useGameStore((state) => state.status === "playing");
  const surface = useGameStore((state) => state.surface);
  const flipping = useGameStore((state) => state.flipping);
  const charge = useGameStore((state) => state.flipCharge);
  const reducedMotion = useGameStore(selectReducedMotion);
  const surfaceLabel = flipping ? "IN TRANSIT" : surface === -1 ? "FLOOR" : "CEILING";

  return (
    <div className="gravity-instrument">
      <div className="cooldown-control relative grid shrink-0 place-items-center">
        <svg viewBox="0 0 56 56" className="pointer-events-none absolute inset-0 h-full w-full -rotate-90"
          role="progressbar" aria-label="Flip cooldown" aria-valuemin={0} aria-valuemax={100} aria-valuenow={Math.round(charge * 100)}>
          <circle cx="28" cy="28" r="25" fill="none" stroke="var(--line)" strokeWidth="2" />
          <motion.circle cx="28" cy="28" r="25" fill="none" stroke={flipping ? "var(--lime)" : "var(--cyan)"}
            strokeWidth="2" strokeLinecap="round" pathLength="1" strokeDasharray="1" initial={false}
            animate={{ strokeDashoffset: 1 - charge }} transition={{ duration: reducedMotion ? 0 : 0.1, ease: "linear" }} />
        </svg>
        <button type="button" className={`gravity-button ${flipping ? "is-flipping" : ""}`}
          disabled={!active || charge < 1} onClick={() => simulation.requestFlip()}
          aria-label="Flip gravity" title="Flip gravity (Space or swipe up)"><ArrowUpDown size={22} /></button>
      </div>
      <div className="gravity-readout">
        <span className="instrument-label">GRAVITY CORE</span>
        <span className="gravity-surface" data-testid="gravity-surface">{surfaceLabel}<span>{flipping ? "SHIFT" : charge < 1 ? "CHARGING" : "READY"}</span></span>
      </div>
    </div>
  );
}

function SteeringControls({ simulation }: { simulation: FlightSimulation }) {
  const active = useGameStore((state) => state.status === "playing");
  return (
    <div className="steering-controls">
      <button className="icon-button" type="button" disabled={!active} aria-label="Steer left" title="Steer left (A / left arrow / swipe left)" onClick={() => simulation.moveLane(-1)}><ArrowLeft size={21} /></button>
      <span className="steering-center" aria-hidden="true">{"//"}</span>
      <button className="icon-button" type="button" disabled={!active} aria-label="Steer right" title="Steer right (D / right arrow / swipe right)" onClick={() => simulation.moveLane(1)}><ArrowRight size={21} /></button>
    </div>
  );
}

function SpeedInstrument() {
  const speed = useGameStore((state) => Math.round(state.speed * 3.6));
  const distance = useGameStore((state) => Math.floor(state.distance));
  return (
    <div className="distance-instrument">
      <span className="instrument-label"><Gauge size={12} /> VELOCITY<span className="speed-value" data-testid="speed-value">{speed} KM/H</span></span>
      <span className="distance-value" data-testid="distance-value">{String(distance).padStart(5, "0")}<small>M</small></span>
    </div>
  );
}

function FlightNotices({ simulation }: { simulation: FlightSimulation }) {
  const visible = useGameStore((state) => state.status === "playing" && state.elapsed >= GAME_CONFIG.onboarding.hintAt && state.flips === 0);
  const flipping = useGameStore((state) => state.flipping);
  const reducedMotion = useGameStore(selectReducedMotion);
  const [closeBonus, setCloseBonus] = useState(0);
  const flash = useRef<HTMLDivElement>(null);

  useEffect(() => {
    let timer: ReturnType<typeof setTimeout> | undefined;
    let animation: Animation | undefined;
    const unsubscribe = simulation.subscribe((event) => {
      if (event.type === "status" && event.status !== "playing") {
        clearTimeout(timer);
        animation?.cancel();
        setCloseBonus(0);
      }
      if (event.type !== "nearMiss") return;
      clearTimeout(timer);
      setCloseBonus(event.bonus);
      timer = setTimeout(() => setCloseBonus(0), GAME_CONFIG.nearMiss.popupSeconds * 1000);
      if (!selectReducedMotion(simulation.store.getState())) {
        animation?.cancel();
        animation = flash.current?.animate([{ opacity: 0.3 }, { opacity: 0 }], { duration: GAME_CONFIG.nearMiss.slowSeconds * 1000, easing: "ease-out" });
      }
    });
    return () => { unsubscribe(); clearTimeout(timer); animation?.cancel(); };
  }, [simulation]);

  return <>
    <div ref={flash} className="near-miss-flash" aria-hidden="true" />
    {closeBonus > 0 ? <motion.div className="close-call" role="status" style={{ x: "-50%" }}
      initial={reducedMotion ? false : { opacity: 0, scale: 0.92 }} animate={{ opacity: 1, scale: 1 }} transition={{ duration: reducedMotion ? 0 : 0.12 }}>
      <strong>CLOSE!</strong><span>+{closeBonus}</span>
    </motion.div> : visible && <button type="button" className="flip-hint" disabled={flipping} onClick={() => simulation.requestFlip()}
      title="Flip gravity (Space, W, up arrow, or swipe up)" aria-label="First flip: flip gravity">
      <ArrowUpDown size={19} /><span>FLIP GRAVITY</span><kbd>SPACE</kbd>
    </button>}
  </>;
}

export function FlightHud({ simulation }: { simulation: FlightSimulation }) {
  const ready = useGameStore((state) => state.ready);
  const flash = useRef<HTMLDivElement>(null);
  useEffect(() => simulation.subscribe((event) => {
    if (event.type === "hit" && !selectReducedMotion(simulation.store.getState())) {
      flash.current?.animate([{ opacity: 0.8 }, { opacity: 0 }], { duration: GAME_CONFIG.effects.hitSeconds * 1000, easing: "ease-out" });
    }
  }), [simulation]);

  return (
    <div className="hud-layer" inert={!ready} aria-hidden={!ready}>
      <div className="screen-vignette" aria-hidden="true" />
      <div ref={flash} className="hit-flash" aria-hidden="true" />
      <FlightHeader simulation={simulation} />
      <div className="telemetry-row"><ShieldInstrument /><ScoreInstrument /></div>
      <div className="flight-crosshair" aria-hidden="true"><Crosshair size={23} strokeWidth={1} /></div>
      <div className="sector-annotation" aria-hidden="true"><span>VECTOR</span><span>01 / ND</span><i /><span>LINK STABLE</span></div>
      <RunMenus simulation={simulation} />
      <FlightNotices simulation={simulation} />
      <footer className="flight-footer">
        <GravityInstrument simulation={simulation} />
        <SteeringControls simulation={simulation} />
        <SpeedInstrument />
      </footer>
    </div>
  );
}