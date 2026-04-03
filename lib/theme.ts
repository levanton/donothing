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
    textSecondary: 'rgba(255,255,255,0.5)',
    textTertiary: 'rgba(255,255,255,0.3)',
    dot: 'rgba(255,255,255,0.35)',
    border: 'rgba(255,255,255,0.15)',
  },
  light: {
    bg: '#f5f2ed',
    text: '#1a1a1a',
    textSecondary: 'rgba(26,26,26,0.5)',
    textTertiary: 'rgba(26,26,26,0.35)',
    dot: 'rgba(26,26,26,0.5)',
    border: 'rgba(26,26,26,0.2)',
  },
};
