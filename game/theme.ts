import { GAME_CONFIG } from "./config.ts";

const palette = {
  background: "#070B1A", primary: "#00F0FF", secondary: "#FF2BD6", accent: "#7B2FFF", orb: "#FFC857",
  text: "#F0F6FF", muted: "#A4B6CB", subtle: "#8394B1", dim: "#4E607F", surface: "#151C34",
  hull: "#A9BDD0", glass: "#10223D", metal: "#26334D", wall: "#0C1227", danger: "#FF5964", shadow: "#000000",
} as const;

export const THEME = {
  palette,
  fonts: { display: '"Space Grotesk", sans-serif', data: '"IBM Plex Mono", monospace' },
  glow: { ui: 1, bloom: 0.9, ribs: 2.1, secondary: 2.2, craft: 1.7, engine: 2.8, obstacle: 2.6, orb: 2.4, burst: 2.6, cockpit: 0.55, wall: 0.3, laser: 1.3 },
  lighting: { ambient: 1.35, key: 3.5, near: 75, far: 70, craft: 4 },
  obstacles: { block: palette.accent, barrier: palette.secondary, laser: palette.danger },
  combo: { secondaryAt: 3 },
} as const;

export function comboColor(combo: number) {
  return combo >= GAME_CONFIG.scoring.maximumCombo ? palette.orb : combo >= THEME.combo.secondaryAt ? palette.secondary : palette.primary;
}

export const THEME_CSS = {
  "--ink": palette.background, "--paper": palette.text, "--muted": palette.muted,
  "--cyan": palette.primary, "--lime": palette.orb, "--orange": palette.secondary,
  "--accent": palette.accent, "--warning": palette.orb, "--danger": palette.danger,
  "--surface": palette.surface, "--on-accent": palette.background,
  "--subtle": palette.subtle, "--dim": palette.dim, "--shadow": palette.shadow,
  "--glass": `color-mix(in srgb, ${palette.surface} 68%, transparent)`,
  "--panel": `color-mix(in srgb, ${palette.background} 97%, transparent)`,
  "--line": `color-mix(in srgb, ${palette.primary} 20%, transparent)`,
  "--lime-hover": `color-mix(in srgb, ${palette.orb} 80%, ${palette.text})`,
  "--glass-shadow": `inset 0 1px 0 color-mix(in srgb, ${palette.text} 6%, transparent), 0 8px 32px color-mix(in srgb, ${palette.shadow} 12%, transparent)`,
  "--font-display": THEME.fonts.display, "--font-data": THEME.fonts.data, "--glow-strength": String(THEME.glow.ui),
} as const;