import { mkdir, writeFile } from "node:fs/promises";
import { GAME_CONFIG } from "../game/config.ts";

const sampleRate = 22050;
const music = new Float32Array(sampleRate * 16);
const effects = new Float32Array(Math.ceil(sampleRate * 3.1));
let noiseSeed = 271828;

function frequency(midiNote: number) {
  return 440 * 2 ** ((midiNote - 69) / 12);
}

function tone(buffer: Float32Array, start: number, duration: number, from: number, to: number, gain: number, harmonics = 0) {
  const offset = Math.round(start * sampleRate);
  const length = Math.round(duration * sampleRate);
  let phase = 0;
  for (let index = 0; index < length && offset + index < buffer.length; index += 1) {
    const progress = index / length;
    const pitch = from * (to / from) ** progress;
    phase += 2 * Math.PI * pitch / sampleRate;
    const envelope = Math.min(1, index / (sampleRate * 0.006)) * (1 - progress) ** 2;
    buffer[offset + index] += gain * envelope * (Math.sin(phase) + harmonics * Math.sin(phase * 2) + harmonics * 0.35 * Math.sin(phase * 3));
  }
}

function noise(buffer: Float32Array, start: number, duration: number, gain: number) {
  const offset = Math.round(start * sampleRate);
  const length = Math.round(duration * sampleRate);
  let lowPass = 0;
  for (let index = 0; index < length && offset + index < buffer.length; index += 1) {
    noiseSeed = (Math.imul(noiseSeed, 1664525) + 1013904223) >>> 0;
    const sample = noiseSeed / 0xffffffff * 2 - 1;
    lowPass += (sample - lowPass) * 0.18;
    const envelope = Math.min(1, index / 32) * (1 - index / length) ** 3;
    buffer[offset + index] += (sample - lowPass) * envelope * gain;
  }
}

const roots = [38, 38, 41, 41, 36, 36, 43, 43];
const arpeggio = [0, 7, 12, 10, 7, 3, 12, 7];
for (let bar = 0; bar < roots.length; bar += 1) {
  const root = roots[bar];
  for (const interval of [0, 7, 12]) {
    const pitch = frequency(root + 24 + interval);
    tone(music, bar * 2, 1.98, pitch, pitch, 0.027, 0.12);
  }
  for (let beat = 0; beat < 4; beat += 1) {
    const time = bar * 2 + beat * 0.5;
    tone(music, time, 0.22, 145, 42, 0.3);
    const bass = frequency(root + (beat === 3 ? 12 : 0));
    tone(music, time + 0.12, 0.32, bass, bass, 0.18, 0.28);
    if (beat % 2 === 1) {
      noise(music, time, 0.13, 0.14);
      tone(music, time, 0.1, 195, 120, 0.07);
    }
  }
  for (let step = 0; step < 8; step += 1) {
    const time = bar * 2 + step * 0.25;
    noise(music, time, step % 2 ? 0.095 : 0.05, step % 2 ? 0.06 : 0.035);
    const pitch = frequency(root + 24 + arpeggio[(step + bar) % arpeggio.length]);
    tone(music, time + 0.05, 0.17, pitch, pitch, 0.055, 0.18);
  }
}

const sprites = GAME_CONFIG.audio.sprites;
for (const [index, pitch] of [880, 1174.66, 1567.98].entries()) {
  tone(effects, sprites.collect[0] / 1000 + index * 0.075, 0.16, pitch, pitch * 1.015, 0.45, 0.2);
}
noise(effects, sprites.hit[0] / 1000, 0.32, 0.5);
tone(effects, sprites.hit[0] / 1000, 0.4, 150, 34, 0.65, 0.3);
tone(effects, sprites.flip[0] / 1000, 0.48, 180, 1450, 0.32, 0.3);
tone(effects, sprites.flip[0] / 1000 + 0.05, 0.38, 600, 160, 0.2);
for (const [index, pitch] of [440, 349.23, 293.66, 146.83].entries()) {
  tone(effects, sprites.gameOver[0] / 1000 + index * 0.25, 0.7, pitch, pitch * 0.99, 0.45, 0.22);
}

function encodeWav(samples: Float32Array) {
  let peak = 0;
  for (const sample of samples) peak = Math.max(peak, Math.abs(sample));
  const gain = peak > 0 ? 0.8 / peak : 0;
  const wav = Buffer.alloc(44 + samples.length * 2);
  wav.write("RIFF", 0);
  wav.writeUInt32LE(wav.length - 8, 4);
  wav.write("WAVEfmt ", 8);
  wav.writeUInt32LE(16, 16);
  wav.writeUInt16LE(1, 20);
  wav.writeUInt16LE(1, 22);
  wav.writeUInt32LE(sampleRate, 24);
  wav.writeUInt32LE(sampleRate * 2, 28);
  wav.writeUInt16LE(2, 32);
  wav.writeUInt16LE(16, 34);
  wav.write("data", 36);
  wav.writeUInt32LE(samples.length * 2, 40);
  for (let index = 0; index < samples.length; index += 1) {
    wav.writeInt16LE(Math.round(samples[index] * gain * 32767), 44 + index * 2);
  }
  return wav;
}

await mkdir(new URL("../public/audio/", import.meta.url), { recursive: true });
for (const [source, samples] of [[GAME_CONFIG.audio.musicSource, music], [GAME_CONFIG.audio.effectsSource, effects]] as const) {
  const wav = encodeWav(samples);
  await writeFile(new URL(`../public${source}`, import.meta.url), wav);
  console.log(`${source}: ${wav.length} bytes, ${samples.length / sampleRate}s`);
}