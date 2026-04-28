export type ThemeMode = 'dark' | 'light';

// ── Base palette ─────────────────────────────────────────────────────────
// Change these values to re-skin the entire app in one place.
export const palette = {
  cream:      '#F9F2E0',
  white:      '#FFFFFF',
  charcoal:   '#444444',
  brown:      '#333431',
  terracotta: '#C26749',
  salmon:     '#E8A99A',
  umber:      '#5C4033',
  danger:     '#D94040',
} as const;

export const CARD_BORDER_WIDTH = 1.5;

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

/**
 * Status-bar style for the active theme. Pass `themeMode` (string)
 * or `isDark` (boolean) — hoists the inline ternaries that were
 * repeated across SessionCompleteScreen, app/index.tsx, onboarding etc.
 */
export function getStatusBarStyle(modeOrDark: ThemeMode | boolean): 'light' | 'dark' {
  const isDark = typeof modeOrDark === 'string' ? modeOrDark === 'dark' : modeOrDark;
  return isDark ? 'light' : 'dark';
}

export const themes: Record<ThemeMode, AppTheme> = {
  dark: {
    bg:            palette.charcoal,
    text:          palette.cream,
    textSecondary: alpha(palette.cream, 0.92),
    textTertiary:  alpha(palette.cream, 0.75),
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
    textSecondary: alpha(palette.brown, 0.9),
    textTertiary:  alpha(palette.brown, 0.7),
    dot:           palette.terracotta,
    border:        alpha(palette.brown, 0.2),
    accent:        palette.terracotta,
    accentText:    palette.cream,
    cardBorder:    alpha(palette.terracotta, 0.3),
    subtle:        alpha(palette.salmon, 0.2),
  },
};
