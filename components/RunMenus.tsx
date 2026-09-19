"use client";

import { useEffect, useRef } from "react";
import { AnimatePresence, motion } from "framer-motion";
import { ArrowLeft, ArrowRight, ChartColumn, Check, Home, Mail, Music2, Play, RotateCcw, Settings2, Sparkles, Trophy, Volume2, Waves, X } from "lucide-react";
import { AnimatedScore, formatScore } from "@/components/AnimatedScore";
import { RunReportContent } from "@/components/PlaytestTools";
import type { FlightSimulation } from "@/game/simulation";
import { DIFFICULTY_PRESETS, type DifficultyPreset } from "@/game/config";
import { DEFAULT_SETTINGS, selectEffectiveQuality, selectReducedMotion, type GameSettings } from "@/store/gameStore";
import { useGameStore } from "@/store/useGameStore";

function RunSummary({ finished }: { finished: boolean }) {
  const score = useGameStore((state) => state.score);
  const distance = useGameStore((state) => Math.floor(state.distance));
  const peakCombo = useGameStore((state) => state.peakCombo);
  return (
    <div className="run-summary">
      <div className="summary-score"><b><AnimatedScore value={score} fromZero duration={1.1} testId="summary-score" /></b>{finished ? "FINAL SCORE" : "CURRENT SCORE"}</div>
      <div><b>{distance.toLocaleString("en-US")}</b>METERS</div>
      <div><b>x{peakCombo}</b>PEAK COMBO</div>
    </div>
  );
}

function RecordCelebration() {
  const newBest = useGameStore((state) => state.score > state.bestAtStart);
  const reducedMotion = useGameStore(selectReducedMotion);
  if (!newBest) return null;
  return (
    <motion.div className="record-celebration" role="status" initial={false}
      animate={reducedMotion ? {} : { scale: [0.96, 1.04, 1] }} transition={{ duration: 0.7 }}>
      <span className="record-emblem"><Trophy size={16} />
        {!reducedMotion && Array.from({ length: 10 }, (_, index) => {
          const angle = index * Math.PI * 2 / 10;
          return <motion.i key={index} aria-hidden="true" initial={{ opacity: 0, x: 0, y: 0, scale: 0 }}
            animate={{ opacity: [0, 1, 0], x: Math.cos(angle) * 48, y: Math.sin(angle) * 38, scale: [0, 1, 0.5], rotate: index * 54 }}
            transition={{ duration: 0.9, delay: 0.15 + index * 0.018 }} />;
        })}
      </span>
      NEW HIGH SCORE <Sparkles size={13} />
    </motion.div>
  );
}

function SettingsContent() {
  const settings = useGameStore((state) => state.settings);
  const quality = useGameStore(selectEffectiveQuality);
  const reducedMotion = useGameStore(selectReducedMotion);
  const updateSettings = useGameStore((state) => state.updateSettings);
  const channels = [
    { key: "masterVolume", label: "Master", icon: Volume2 },
    { key: "musicVolume", label: "Music", icon: Music2 },
    { key: "effectsVolume", label: "Effects", icon: Waves },
  ] as const;

  return (
    <div className="settings-content">
      <fieldset className="settings-section quality-setting">
        <legend>DIFFICULTY <span>NEXT RUN</span></legend>
        <div className="quality-options">{(Object.keys(DIFFICULTY_PRESETS) as DifficultyPreset[]).map((difficulty) => (
          <label key={difficulty} className="quality-option"><input type="radio" name="difficulty" value={difficulty}
            checked={settings.difficulty === difficulty} onChange={() => updateSettings({ difficulty })} />
            <span>{difficulty}<Check size={14} aria-hidden="true" /></span></label>
        ))}</div>
      </fieldset>
      <fieldset className="settings-section quality-setting">
        <legend>GRAPHICS QUALITY <span className="uppercase">RENDERING: {quality}</span></legend>
        <div className="quality-options">
          {(["low", "medium", "high"] as const).map((quality) => (
            <label key={quality} className="quality-option">
              <input type="radio" name="quality" value={quality} checked={settings.quality === quality}
                onChange={() => updateSettings({ quality })} />
              <span>{quality}<Check size={14} aria-hidden="true" /></span>
            </label>
          ))}
        </div>
        <label className="motion-setting audio-mute-setting" htmlFor="adaptive-quality">
          <span><Settings2 size={17} />Adaptive quality</span>
          <input id="adaptive-quality" type="checkbox" role="switch" checked={settings.adaptiveQuality}
            onChange={(event) => updateSettings({ adaptiveQuality: event.target.checked })} />
        </label>
      </fieldset>
      <fieldset className="settings-section audio-setting">
        <legend>AUDIO <span>{settings.muted ? "MUTED" : "ON"}</span></legend>
        {channels.map(({ key, label, icon: Icon }) => (
          <div className="volume-control" key={key}>
            <label htmlFor={key}><Icon size={16} />{label}<output htmlFor={key}>{Math.round(settings[key] * 100)}%</output></label>
            <input id={key} type="range" min={0} max={100} step={1} value={Math.round(settings[key] * 100)}
              aria-valuetext={`${Math.round(settings[key] * 100)} percent`}
              style={{ backgroundSize: `${settings[key] * 100}% 100%` }}
              onChange={(event) => updateSettings({ [key]: Number(event.target.value) / 100 } as Partial<GameSettings>)} />
          </div>
        ))}
        <label className="motion-setting audio-mute-setting" htmlFor="mute-audio">
          <span><Volume2 size={17} />Mute audio</span>
          <input id="mute-audio" type="checkbox" role="switch" checked={settings.muted}
            onChange={(event) => updateSettings({ muted: event.target.checked })} />
        </label>
      </fieldset>
      <label className="motion-setting" htmlFor="reduced-motion">
        <span><Sparkles size={17} />Reduced motion</span>
        <input id="reduced-motion" type="checkbox" role="switch" checked={reducedMotion}
          onChange={(event) => updateSettings({ reducedMotion: event.target.checked })} />
      </label>
      <label className="motion-setting audio-mute-setting" htmlFor="show-feedback">
        <span><Mail size={17} />Feedback button</span>
        <input id="show-feedback" type="checkbox" role="switch" checked={settings.showFeedback}
          onChange={(event) => updateSettings({ showFeedback: event.target.checked })} />
      </label>
    </div>
  );
}

function LeaderboardContent() {
  const records = useGameStore((state) => state.leaderboard);
  const highScore = useGameStore((state) => state.highScore);
  return (
    <div className="leaderboard-content">
      <div className="leaderboard-best"><span><Trophy size={16} />PERSONAL BEST</span><strong>{formatScore(highScore)}</strong></div>
      {records.length ? (
        <table className="leaderboard-table">
          <caption className="sr-only">Your top five completed runs on this device</caption>
          <thead><tr><th scope="col">RANK</th><th scope="col">SCORE</th><th scope="col">METERS</th><th scope="col">COMBO</th></tr></thead>
          <tbody>{records.map((record, index) => (
            <tr key={record.id}><td><span>{String(index + 1).padStart(2, "0")}</span>{index === 0 && <Trophy size={12} aria-label="First place" />}</td>
              <td title={String(record.score)}>{formatScore(record.score)}</td><td>{formatScore(record.distance)}</td><td>x{record.peakCombo}</td></tr>
          ))}</tbody>
        </table>
      ) : <div className="leaderboard-empty"><Trophy size={38} strokeWidth={1} /><span>NO COMPLETED RUNS</span></div>}
      <div className="panel-footnote"><span className="status-dot" /> ON THIS DEVICE <span>TOP 05</span></div>
    </div>
  );
}

function MenuDialog({ panel }: { panel: "settings" | "leaderboard" | "report" }) {
  const dialog = useRef<HTMLDialogElement>(null);
  const closePanel = useGameStore((state) => state.closePanel);
  const updateSettings = useGameStore((state) => state.updateSettings);
  const reducedMotion = useGameStore(selectReducedMotion);

  useEffect(() => {
    const element = dialog.current;
    const previousFocus = document.activeElement instanceof HTMLElement ? document.activeElement : null;
    element?.showModal();
    return () => {
      element?.close();
      previousFocus?.focus({ preventScroll: true });
    };
  }, []);

  return (
    <motion.dialog ref={dialog} className="menu-dialog" aria-labelledby="panel-title" data-panel={panel}
      initial={{ opacity: 0, y: reducedMotion ? 0 : 14 }} animate={{ opacity: 1, y: 0 }} exit={{ opacity: 0 }}
      transition={{ duration: reducedMotion ? 0 : 0.2 }}
      onCancel={(event) => { event.preventDefault(); closePanel(); }}
      onClick={(event) => {
        if (event.target !== event.currentTarget) return;
        const bounds = event.currentTarget.getBoundingClientRect();
        if (event.clientX < bounds.left || event.clientX > bounds.right || event.clientY < bounds.top || event.clientY > bounds.bottom) closePanel();
      }}>
      <header className="panel-header">
        <div><div className="panel-kicker">{panel === "settings" ? "FLIGHT PREFERENCES" : "LOCAL RECORDS"}</div>
          <h2 id="panel-title">{panel === "settings" ? <Settings2 size={22} /> : panel === "report" ? <ChartColumn size={22} /> : <Trophy size={22} />}{panel === "settings" ? "SETTINGS" : panel === "report" ? "RUN REPORT" : "LEADERBOARD"}</h2></div>
        <button type="button" className="icon-button" onClick={closePanel} aria-label="Close panel" title="Close panel"><X size={19} /></button>
      </header>
      {panel === "settings" ? <SettingsContent /> : panel === "report" ? <RunReportContent /> : <LeaderboardContent />}
      <footer className="panel-footer">
        <button type="button" className="secondary-button" onClick={closePanel}><ArrowLeft size={16} />BACK</button>
        {panel === "settings" && <button type="button" className="icon-button" aria-label="Reset settings" title="Reset settings"
          onClick={() => updateSettings(DEFAULT_SETTINGS)}><RotateCcw size={17} /></button>}
      </footer>
    </motion.dialog>
  );
}

export function RunMenus({ simulation }: { simulation: FlightSimulation }) {
  const status = useGameStore((state) => state.status);
  const ready = useGameStore((state) => state.ready);
  const panel = useGameStore((state) => state.panel);
  const openPanel = useGameStore((state) => state.openPanel);
  const reducedMotion = useGameStore(selectReducedMotion);
  const primaryAction = useRef<HTMLButtonElement>(null);
  const interaction = reducedMotion ? {} : { whileHover: { y: -2 }, whileTap: { scale: 0.97, y: 0 } };

  function startRun() {
    if (!ready) return;
    if (status === "paused") simulation.togglePause();
    else simulation.start();
    (document.activeElement as HTMLElement | null)?.blur();
  }

  function retryRun() {
    simulation.returnToMenu();
    simulation.start();
    (document.activeElement as HTMLElement | null)?.blur();
  }

  return (
    <>
      <AnimatePresence mode="wait">
        {status !== "playing" && (
          <motion.section key={status} className="run-overlay" data-state={status}
            initial={{ opacity: 0, y: reducedMotion ? 0 : 16 }} animate={{ opacity: 1, y: 0 }}
            exit={{ opacity: 0, y: reducedMotion ? 0 : -8, pointerEvents: "none" }}
            transition={{ duration: reducedMotion ? 0 : 0.24 }}
            onAnimationComplete={() => {
              if (simulation.state.status === status && simulation.store.getState().panel === null) primaryAction.current?.focus({ preventScroll: true });
            }}
            aria-label={status === "menu" ? "Launch flight" : status === "paused" ? "Flight paused" : "Run complete"}>
            <div className="eyebrow"><span className="eyebrow-line" />{status === "menu" ? "GRAVITY DIVISION / 001" : status === "paused" ? "FLIGHT ON HOLD" : "SIGNAL LOST"}</div>
            <h1 className={status === "menu" ? "neon-title" : "result-title"}>{status === "menu" ? <>NEON<br /><span>DRIFT</span><span className="title-period">.</span></> : status === "paused" ? <>HOLD<br /><span>STEADY.</span></> : <>RUN<br /><span>COMPLETE.</span></>}</h1>
            {status === "gameOver" && <RecordCelebration />}
            {status !== "menu" && <RunSummary finished={status === "gameOver"} />}
            <div className="run-actions">
              <motion.button ref={primaryAction} {...interaction} type="button" className="launch-button" disabled={!ready} onClick={startRun}>
                {status === "gameOver" ? <RotateCcw size={18} /> : <Play size={17} fill="currentColor" />}
                <span>{!ready ? "INITIALIZING" : status === "menu" ? "PLAY" : status === "paused" ? "RESUME" : "RETRY"}</span><ArrowRight size={20} />
              </motion.button>
              {status !== "menu" && <motion.button {...interaction} type="button" className="secondary-button" onClick={() => simulation.returnToMenu()}><Home size={16} />MENU</motion.button>}
            </div>
            <nav className="menu-navigation" aria-label={status === "menu" ? "Main menu" : "Run options"}>
              {status === "paused" && <motion.button {...interaction} className="secondary-button" type="button" onClick={retryRun}><RotateCcw size={15} />RETRY</motion.button>}
              <motion.button {...interaction} className="secondary-button" type="button" onClick={() => openPanel("settings")}><Settings2 size={15} />SETTINGS</motion.button>
              {status !== "paused" && <motion.button {...interaction} className="secondary-button" type="button" onClick={() => openPanel("leaderboard")}><Trophy size={15} />LEADERBOARD</motion.button>}
            </nav>
            <div className="run-signature"><span className="status-dot" />{status === "menu" ? "VECTOR-01" : status === "paused" ? "SYSTEMS STANDBY" : "UPLINK AVAILABLE"}<span>NEON RACING DIVISION</span></div>
          </motion.section>
        )}
      </AnimatePresence>
      <AnimatePresence>{panel !== null && <MenuDialog key={panel} panel={panel} />}</AnimatePresence>
      <span className="sr-only" aria-live="polite">{status === "gameOver" ? "Run ended. Shield depleted." : status === "paused" ? "Flight paused." : ""}</span>
    </>
  );
}