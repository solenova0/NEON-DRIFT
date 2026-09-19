"use client";

import { useState } from "react";
import { ChartColumn, Download, Mail, X } from "lucide-react";
import { GAME_CONFIG, type DifficultyPreset } from "@/game/config";
import { difficultyAt } from "@/game/difficulty";
import type { FlightSimulation } from "@/game/simulation";
import { feedbackHref, summarizeRuns } from "@/store/runHistory";
import { useGameStore } from "@/store/useGameStore";

function DebugReadout({ simulation }: { simulation: FlightSimulation }) {
  const fps = useGameStore((state) => state.debugFps);
  const speed = useGameStore((state) => state.speed);
  const density = useGameStore((state) => state.density);
  const elapsed = useGameStore((state) => state.elapsed);
  const aliveTime = useGameStore((state) => state.aliveTime);
  const preset = useGameStore((state) => state.runDifficulty);
  const disable = useGameStore((state) => state.setDebugEnabled);
  const level = Math.min(GAME_CONFIG.difficulty.levels, 1 + Math.floor(difficultyAt(elapsed, preset).progress * GAME_CONFIG.difficulty.levels));
  return (
    <aside className="debug-readout" aria-label="Playtest telemetry">
      <dl>{[["FPS", fps || "--"], ["M/S", speed.toFixed(1)], ["LEVEL", level], ["DENSITY", `${Math.round(density * 100)}%`], ["ALIVE", `${aliveTime.toFixed(1)}s`]].map(([label, value]) => (
        <div key={label}><dt>{label}</dt><dd>{value}</dd></div>
      ))}</dl>
      <button type="button" className="icon-button" aria-label="Run report" title="Run report" onClick={() => {
        simulation.pause();
        simulation.store.getState().openPanel("report");
      }}><ChartColumn size={17} /></button>
      <button type="button" className="icon-button" aria-label="Hide debug mode" title="Hide debug mode (`)" onClick={() => disable(false)}><X size={17} /></button>
    </aside>
  );
}

export function PlaytestTools({ simulation }: { simulation: FlightSimulation }) {
  const debug = useGameStore((state) => state.debugEnabled);
  const feedback = useGameStore((state) => state.settings.showFeedback);
  const ready = useGameStore((state) => state.ready);
  const playing = useGameStore((state) => state.status === "playing");
  const lastRun = useGameStore((state) => state.runHistory.at(-1));
  if (!ready) return null;
  return <>
    {debug && <DebugReadout simulation={simulation} />}
    {feedback && playing && <a className="secondary-button feedback-link" href={feedbackHref(lastRun)} onClick={() => simulation.pause()}><Mail size={14} />Send feedback</a>}
  </>;
}

export function RunReportContent() {
  const runs = useGameStore((state) => state.runHistory);
  const [preset, setPreset] = useState<DifficultyPreset | "all">("normal");
  const persistent = useGameStore((state) => state.historyStorageAvailable);
  const report = summarizeRuns(preset === "all" ? runs : runs.filter((run) => run.difficulty === preset));
  const lastRun = runs.at(-1);
  function exportRuns() {
    const url = URL.createObjectURL(new Blob([JSON.stringify({ version: 1, exportedAt: new Date().toISOString(), runs }, null, 2)], { type: "application/json" }));
    const anchor = document.createElement("a");
    anchor.href = url;
    anchor.download = `neon-drift-runs-${new Date().toISOString().slice(0, 10)}.json`;
    anchor.click();
    setTimeout(() => URL.revokeObjectURL(url), 0);
  }
  return (
    <div className="run-report">
      <label className="report-filter">DIFFICULTY <select value={preset} aria-label="Report difficulty" onChange={(event) => setPreset(event.target.value as DifficultyPreset | "all")}>
        {(["all", "chill", "normal", "intense"] as const).map((option) => <option key={option} value={option}>{option.toUpperCase()}</option>)}
      </select></label>
      <dl className="report-summary">
        <div><dt>AVG SURVIVAL / DEATHS ONLY</dt><dd>{report.averageSurvival === null ? "--" : `${report.averageSurvival.toFixed(1)}s`}</dd></div>
        <div><dt>RUNS / DEATHS</dt><dd>{report.total} / {report.deaths}</dd></div>
      </dl>
      <table className="leaderboard-table"><caption>DEATHS BY OBSTACLE</caption>
        <thead><tr><th scope="col">CAUSE</th><th scope="col">DEATHS</th></tr></thead>
        <tbody>{report.causes.map(({ obstacle, count }) => <tr key={obstacle}><th scope="row">{obstacle.toUpperCase()}</th><td>{count}</td></tr>)}</tbody>
      </table>
      <table className="leaderboard-table"><caption>DEATH WINDOWS</caption>
        <thead><tr><th scope="col">TIME ALIVE</th><th scope="col">DEATHS</th></tr></thead>
        <tbody>{report.windows.map(({ start, end, count }) => <tr key={start}><th scope="row">{start}{Number.isFinite(end) ? `-${end}s` : "s+"}</th><td>{count}</td></tr>)}</tbody>
      </table>
      {lastRun && <p className="last-run-details">LAST: {lastRun.ending.toUpperCase()} / {lastRun.duration.toFixed(1)}s / {lastRun.score} PTS<br />
        {lastRun.death ? `${lastRun.death.obstacle.toUpperCase()} / CHUNK ${lastRun.death.chunkIndex} / ${lastRun.death.distance.toFixed(1)}m` : "NO LETHAL COLLISION"}</p>}
      <div className="report-actions"><button type="button" className="secondary-button" onClick={exportRuns} disabled={!runs.length}><Download size={15} />EXPORT JSON</button>
        <a className="secondary-button" href={feedbackHref(lastRun)}><Mail size={15} />SEND FEEDBACK</a></div>
      <p className="panel-footnote">{persistent ? "LOCAL ONLY" : "SESSION ONLY / STORAGE UNAVAILABLE"} <span>LAST {GAME_CONFIG.playtest.maximumRuns}</span></p>
    </div>
  );
}