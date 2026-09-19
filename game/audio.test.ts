import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import test from "node:test";
import type { HowlOptions } from "howler";
import { FlightAudio, type AudioClip } from "./audio.ts";
import { GAME_CONFIG } from "./config.ts";
import { DEFAULT_SETTINGS } from "../store/gameStore.ts";

class TestClip implements AudioClip {
  readonly options: HowlOptions;
  readonly active = new Set<number>();
  readonly calls: Array<string | number | undefined> = [];
  currentVolume = 0;
  muted = false;
  unloaded = false;
  private nextId = 0;
  constructor(options: HowlOptions) { this.options = options; }
  play(spriteOrId?: string | number) {
    const id = typeof spriteOrId === "number" ? spriteOrId : ++this.nextId;
    this.active.add(id);
    this.calls.push(spriteOrId);
    return id;
  }
  pause(id?: number) { if (id !== undefined) this.active.delete(id); }
  stop(id?: number) { if (id === undefined) this.active.clear(); else this.active.delete(id); }
  playing(id?: number) { return id === undefined ? this.active.size > 0 : this.active.has(id); }
  volume(value: number) { this.currentVolume = value; }
  mute(muted: boolean) { this.muted = muted; }
  state(): "loaded" | "unloaded" { return this.unloaded ? "unloaded" : "loaded"; }
  unload() { this.unloaded = true; this.active.clear(); }
}

function audioFixture() {
  const clips: TestClip[] = [];
  const audio = new FlightAudio({ ...DEFAULT_SETTINGS }, "menu", (options) => {
    const clip = new TestClip(options);
    clips.push(clip);
    return clip;
  });
  return { audio, music: clips[0], effects: clips[1] };
}

test("audio stays silent until unlock and reuses one looping music voice", () => {
  const { audio, music } = audioFixture();
  audio.handle({ type: "status", status: "playing" });
  assert.equal(music.calls.length, 0);
  assert.equal(music.options.loop, true);
  audio.unlock();
  audio.unlock();
  audio.setSettings({ ...DEFAULT_SETTINGS, musicVolume: 0.3 });
  assert.equal(music.calls.length, 1);
  assert.equal(music.currentVolume, DEFAULT_SETTINGS.masterVolume * 0.3 * GAME_CONFIG.audio.musicGain);
  audio.dispose();
});

test("muting, pausing, and losing focus stop audio; resuming does not duplicate the loop", () => {
  const { audio, music, effects } = audioFixture();
  audio.unlock();
  audio.handle({ type: "flip", surface: 1 });
  audio.setSettings({ ...DEFAULT_SETTINGS, muted: true });
  assert.equal(music.playing(), false);
  assert.equal(effects.active.size, 0);
  audio.setSettings({ ...DEFAULT_SETTINGS });
  assert.equal(music.active.size, 1);
  audio.handle({ type: "status", status: "paused" });
  assert.equal(music.playing(), false);
  audio.handle({ type: "status", status: "playing" });
  audio.setForeground(false);
  assert.equal(music.playing(), false);
  audio.setForeground(true);
  assert.equal(music.active.size, 1);
  audio.dispose();
});

test("effect voices are bounded and every cue, including game over, is routed once", () => {
  const { audio, effects } = audioFixture();
  audio.unlock();
  audio.handle({ type: "status", status: "playing" });
  for (let index = 0; index < 100; index += 1) audio.handle({ type: "flip", surface: 1 });
  audio.handle({ type: "collect", energy: 10, score: 100, combo: 1, bonus: 100, x: 0, y: 0, z: 0 });
  audio.handle({ type: "hit", shield: 75, x: 0, y: 0, z: 0 });
  audio.handle({ type: "status", status: "gameOver" });
  audio.handle({ type: "status", status: "gameOver" });
  assert.deepEqual(audio.snapshot().played, { flip: 100, collect: 1, hit: 1, gameOver: 1 });
  assert.equal(effects.active.size, GAME_CONFIG.audio.maximumVoices);
  assert.equal(audio.snapshot().activeVoices, GAME_CONFIG.audio.maximumVoices);
  audio.dispose();
});

test("disposing audio unloads both banks and ignores late load callbacks", () => {
  const { audio, music, effects } = audioFixture();
  audio.unlock();
  audio.dispose();
  audio.dispose();
  music.options.onload?.(1);
  audio.unlock();
  audio.handle({ type: "flip", surface: 1 });
  assert.equal(music.unloaded, true);
  assert.equal(effects.unloaded, true);
  assert.equal(audio.snapshot().activeVoices, 0);
  assert.equal(music.calls.length, 1);
});

function readAudio(source: string) {
  const wav = readFileSync(new URL(`../public${source}`, import.meta.url));
  assert.equal(wav.toString("ascii", 0, 4), "RIFF");
  assert.equal(wav.toString("ascii", 8, 12), "WAVE");
  assert.equal(wav.readUInt16LE(22), 1);
  assert.equal(wav.readUInt16LE(34), 16);
  assert.equal(wav.readUInt32LE(40), wav.length - 44);
  const samples = new Int16Array((wav.length - 44) / 2);
  for (let index = 0; index < samples.length; index += 1) samples[index] = wav.readInt16LE(44 + index * 2);
  return { samples, sampleRate: wav.readUInt32LE(24) };
}

test("the original music loop contains signal, has quiet endpoints, and never clips", () => {
  const { samples, sampleRate } = readAudio(GAME_CONFIG.audio.musicSource);
  assert.equal(samples.length / sampleRate, 16);
  assert.equal(samples[0], 0);
  assert.ok(Math.abs(samples.at(-1)!) < 2);
  let squareSum = 0;
  let peak = 0;
  for (const sample of samples) {
    squareSum += sample * sample;
    peak = Math.max(peak, Math.abs(sample));
  }
  assert.ok(Math.sqrt(squareSum / samples.length) > 1000);
  assert.ok(peak < 30000);
});

test("every effect sprite is nonempty, nonoverlapping, and inside the sound bank", () => {
  const { samples, sampleRate } = readAudio(GAME_CONFIG.audio.effectsSource);
  let previousEnd = 0;
  for (const [offset, duration] of Object.values(GAME_CONFIG.audio.sprites)) {
    assert.ok(offset >= previousEnd);
    const start = Math.round(offset * sampleRate / 1000);
    const end = Math.round((offset + duration) * sampleRate / 1000);
    assert.ok(end <= samples.length);
    assert.ok(samples.slice(start, end).some((sample) => Math.abs(sample) > 1000));
    previousEnd = offset + duration;
  }
});