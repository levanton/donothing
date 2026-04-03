export type ThemeMode = 'dark' | 'light';

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
    bg: '#0a0a0a',
    text: '#ffffff',
    textSecondary: 'rgba(255,255,255,0.65)',
    textTertiary: 'rgba(255,255,255,0.4)',
    dot: 'rgba(255,255,255,0.4)',
    border: 'rgba(255,255,255,0.15)',
  },
  light: {
    bg: '#f5f2ed',
    text: '#1a1a1a',
    textSecondary: 'rgba(26,26,26,0.6)',
    textTertiary: 'rgba(26,26,26,0.4)',
    dot: 'rgba(26,26,26,0.55)',
    border: 'rgba(26,26,26,0.2)',
  },
};
