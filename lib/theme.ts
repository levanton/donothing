export type ThemeMode = 'dark' | 'light';

// ── Base palette ─────────────────────────────────────────────────────────
// Change these values to re-skin the entire app in one place.
export const palette = {
  cream:      '#F5EFE6',
  charcoal:   '#1C1A17',
  brown:      '#2B2522',
  terracotta: '#C75B3A',
} as const;

// ── Opacity helpers ──────────────────────────────────────────────────────
const alpha = (hex: string, opacity: number): string => {
  const r = parseInt(hex.slice(1, 3), 16);
  const g = parseInt(hex.slice(3, 5), 16);
  const b = parseInt(hex.slice(5, 7), 16);
  return `rgba(${r},${g},${b},${opacity})`;
};

// ── Theme tokens ─────────────────────────────────────────────────────────
export interface AppTheme {
  bg: string;
  text: string;
  textSecondary: string;
  textTertiary: string;
  dot: string;
  border: string;
}

export const themes: Record<ThemeMode, AppTheme> = {
  dark: {
    bg:            palette.charcoal,
    text:          palette.cream,
    textSecondary: alpha(palette.cream, 0.6),
    textTertiary:  alpha(palette.cream, 0.4),
    dot:           palette.terracotta,
    border:        alpha(palette.cream, 0.18),
  },
  light: {
    bg:            palette.cream,
    text:          palette.brown,
    textSecondary: alpha(palette.brown, 0.55),
    textTertiary:  alpha(palette.brown, 0.35),
    dot:           palette.terracotta,
    border:        alpha(palette.brown, 0.25),
  },
};
