import { GAME_CONFIG } from "./config.ts";

export class FrameMonitor {
  private warmup: number = GAME_CONFIG.performance.warmupSeconds;
  private elapsed = 0;
  private frames = 0;
  private lowWindows = 0;

  reset() {
    this.warmup = GAME_CONFIG.performance.warmupSeconds;
    this.elapsed = 0;
    this.frames = 0;
    this.lowWindows = 0;
  }

  sample(seconds: number, active = true) {
    if (!active) {
      this.reset();
      return null;
    }
    if (!Number.isFinite(seconds) || seconds <= 0) return null;
    if (this.warmup > 0) {
      this.warmup = Math.max(0, this.warmup - seconds);
      return null;
    }
    this.elapsed += seconds;
    this.frames += 1;
    if (this.elapsed + 1e-8 < GAME_CONFIG.performance.sampleSeconds) return null;
    const fps = this.frames / this.elapsed;
    this.lowWindows = fps < GAME_CONFIG.performance.minimumFps - 0.001 ? this.lowWindows + 1 : 0;
    const reduce = this.lowWindows >= GAME_CONFIG.performance.lowWindows;
    if (reduce) {
      this.lowWindows = 0;
      this.warmup = GAME_CONFIG.performance.settleSeconds;
    }
    this.elapsed = 0;
    this.frames = 0;
    return { fps, reduce };
  }
}