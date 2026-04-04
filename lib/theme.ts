export type ThemeMode = 'dark' | 'light';

// ── Base palette ─────────────────────────────────────────────────────────
// Change these values to re-skin the entire app in one place.
export const palette = {
  cream:      '#F5EDDF',
  charcoal:   '#3D3A36',
  brown:      '#2B2522',
  terracotta: '#C75B3A',
  salmon:     '#E8A99A',
  warmGray:   '#D9CFC2',
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
  accent: string;
  accentText: string;
  cardBorder: string;
  subtle: string;
}

export const themes: Record<ThemeMode, AppTheme> = {
  dark: {
    bg:            palette.charcoal,
    text:          palette.cream,
    textSecondary: alpha(palette.cream, 0.6),
    textTertiary:  alpha(palette.cream, 0.4),
    dot:           palette.terracotta,
    border:        alpha(palette.cream, 0.18),
    accent:        palette.terracotta,
    accentText:    palette.cream,
    cardBorder:    alpha(palette.salmon, 0.3),
    subtle:        alpha(palette.salmon, 0.12),
  },
  light: {
    bg:            palette.cream,
    text:          palette.brown,
    textSecondary: alpha(palette.brown, 0.55),
    textTertiary:  alpha(palette.brown, 0.35),
    dot:           palette.terracotta,
    border:        alpha(palette.brown, 0.2),
    accent:        palette.terracotta,
    accentText:    palette.cream,
    cardBorder:    alpha(palette.terracotta, 0.3),
    subtle:        alpha(palette.salmon, 0.2),
  },
};
