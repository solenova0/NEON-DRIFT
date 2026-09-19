import assert from "node:assert/strict";
import test from "node:test";
import { FrameMonitor } from "./performance.ts";

function sampleFrames(monitor: FrameMonitor, fps: number, seconds: number, active = true) {
  const reports = [];
  for (let frame = 0; frame < fps * seconds; frame += 1) {
    const report = monitor.sample(1 / fps, active);
    if (report) reports.push(report);
  }
  return reports;
}

test("sustained sub-45 FPS lowers quality only after warmup and three low windows", () => {
  const monitor = new FrameMonitor();
  assert.equal(sampleFrames(monitor, 30, 4).some((report) => report.reduce), false);
  assert.equal(sampleFrames(monitor, 30, 2).filter((report) => report.reduce).length, 1);
  assert.equal(sampleFrames(monitor, 30, 2).some((report) => report.reduce), false);
  assert.equal(sampleFrames(monitor, 30, 5).filter((report) => report.reduce).length, 1);
});

test("healthy frames, isolated hitches, and exactly 45 FPS never trigger a downgrade", () => {
  const monitor = new FrameMonitor();
  assert.equal(sampleFrames(monitor, 60, 5).some((report) => report.reduce), false);
  monitor.sample(4);
  assert.equal(sampleFrames(monitor, 60, 4).some((report) => report.reduce), false);
  assert.equal(sampleFrames(monitor, 45, 10).some((report) => report.reduce), false);
});

test("paused or hidden time resets the low-FPS streak rather than reducing quality", () => {
  const monitor = new FrameMonitor();
  sampleFrames(monitor, 30, 4);
  sampleFrames(monitor, 1, 30, false);
  assert.equal(sampleFrames(monitor, 30, 4).some((report) => report.reduce), false);
});

test("invalid frame deltas cannot corrupt the frame monitor", () => {
  const monitor = new FrameMonitor();
  for (const delta of [NaN, Infinity, -1, 0]) assert.equal(monitor.sample(delta), null);
  const reports = sampleFrames(monitor, 60, 5);
  assert.ok(reports.length >= 2);
  assert.ok(reports.every((report) => Math.abs(report.fps - 60) < 0.001 && !report.reduce));
});