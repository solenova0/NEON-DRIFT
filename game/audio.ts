import { Howl, Howler, type HowlOptions } from "howler";
import { GAME_CONFIG } from "./config.ts";
import type { GameEvent } from "./simulation.ts";
import type { GameSettings, GameStatus } from "../store/gameStore.ts";

export interface AudioClip {
  play(spriteOrId?: string | number): number;
  pause(id?: number): unknown;
  stop(id?: number): unknown;
  playing(id?: number): boolean;
  volume(value: number): unknown;
  mute(muted: boolean): unknown;
  state(): "unloaded" | "loading" | "loaded";
  unload(): unknown;
}

type SoundEffect = keyof typeof GAME_CONFIG.audio.sprites;
type AudioFactory = (options: HowlOptions) => AudioClip;

export class FlightAudio {
  private readonly music: AudioClip;
  private readonly effects: AudioClip;
  private readonly voices = new Set<number>();
  private settings: GameSettings;
  private status: GameStatus;
  private musicId: number | undefined;
  private unlocked = false;
  private foreground = true;
  private disposed = false;
  private failedLoads = 0;
  private readonly played: Record<SoundEffect, number> = { collect: 0, hit: 0, flip: 0, gameOver: 0 };

  constructor(settings: GameSettings, status: GameStatus, createClip: AudioFactory = (options) => new Howl(options)) {
    this.settings = settings;
    this.status = status;
    const sprite: Record<string, [number, number]> = {};
    for (const [name, [offset, duration]] of Object.entries(GAME_CONFIG.audio.sprites)) sprite[name] = [offset, duration];
    this.music = createClip({
      src: [GAME_CONFIG.audio.musicSource], loop: true, preload: true,
      volume: 0, mute: settings.muted,
      onload: () => this.syncPlayback(),
      onloaderror: () => { this.failedLoads += 1; },
      onplayerror: () => { this.unlocked = false; this.musicId = undefined; },
    });
    this.effects = createClip({
      src: [GAME_CONFIG.audio.effectsSource], sprite, preload: true, pool: GAME_CONFIG.audio.maximumVoices,
      volume: 0, mute: settings.muted,
      onend: (id) => { this.voices.delete(id); },
      onstop: (id) => { this.voices.delete(id); },
      onloaderror: () => { this.failedLoads += 1; },
      onplayerror: (id) => { this.voices.delete(id); },
    });
  }

  unlock() {
    if (this.disposed) return;
    this.unlocked = true;
    if (Howler.ctx && Howler.ctx.state !== "running" && Howler.ctx.state !== "closed") {
      void Howler.ctx.resume().then(() => this.syncPlayback()).catch(() => { this.unlocked = false; });
    }
    this.syncPlayback();
  }

  setSettings(settings: GameSettings) {
    this.settings = settings;
    this.syncPlayback();
  }

  setForeground(foreground: boolean) {
    this.foreground = foreground;
    this.syncPlayback();
  }

  handle(event: GameEvent) {
    if (this.disposed) return;
    if (event.type === "status") {
      const previous = this.status;
      this.status = event.status;
      this.syncPlayback();
      if (event.status === "gameOver" && previous !== "gameOver") this.playEffect("gameOver");
    } else {
      this.playEffect(event.type);
    }
  }

  private syncPlayback() {
    if (this.disposed) return;
    const { masterVolume, musicVolume, effectsVolume, muted } = this.settings;
    this.music.mute(muted);
    this.effects.mute(muted);
    this.music.volume(masterVolume * musicVolume * GAME_CONFIG.audio.musicGain * (this.status === "playing" ? 1 : 0.65));
    this.effects.volume(masterVolume * effectsVolume * GAME_CONFIG.audio.effectsGain);
    const audible = this.unlocked && this.foreground && !muted && masterVolume > 0 && this.status !== "paused";
    if (!audible) {
      if (this.musicId !== undefined) this.music.pause(this.musicId);
      this.effects.stop();
      this.voices.clear();
    } else if (musicVolume === 0) {
      if (this.musicId !== undefined) this.music.pause(this.musicId);
    } else if (this.music.state() === "loaded" && !this.music.playing(this.musicId)) {
      this.musicId = this.music.play(this.musicId);
    }
  }

  private playEffect(effect: SoundEffect) {
    if (!this.unlocked || !this.foreground || this.settings.muted || this.settings.masterVolume === 0 ||
      this.settings.effectsVolume === 0 || this.status === "paused" || this.effects.state() !== "loaded") return;
    if (this.voices.size >= GAME_CONFIG.audio.maximumVoices) {
      const oldest = this.voices.values().next().value;
      if (oldest !== undefined) {
        this.effects.stop(oldest);
        this.voices.delete(oldest);
      }
    }
    this.voices.add(this.effects.play(effect));
    this.played[effect] += 1;
  }

  snapshot() {
    return {
      unlocked: this.unlocked, disposed: this.disposed, foreground: this.foreground,
      musicPlaying: this.music.playing(this.musicId), musicState: this.music.state(), effectsState: this.effects.state(),
      activeVoices: this.voices.size, played: { ...this.played }, failedLoads: this.failedLoads,
      contextState: Howler.ctx?.state ?? "unavailable", muted: this.settings.muted,
    };
  }

  dispose() {
    if (this.disposed) return;
    this.disposed = true;
    this.unlocked = false;
    this.music.unload();
    this.effects.unload();
    this.voices.clear();
    this.musicId = undefined;
  }
}