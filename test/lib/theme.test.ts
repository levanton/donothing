import { palette, themes, getStatusBarStyle, APP_BG } from '@/lib/theme';

describe('palette', () => {
  it('every color is a hex string', () => {
    for (const [name, value] of Object.entries(palette)) {
      expect(typeof value).toBe('string');
      expect(value).toMatch(/^#[0-9A-Fa-f]{6}$/);
      expect(name.length).toBeGreaterThan(0);
    }
  });
});

describe('APP_BG', () => {
  it('matches the warmCream palette token (single source of truth)', () => {
    expect(APP_BG).toBe(palette.warmCream);
  });
});

describe('themes', () => {
  it('exposes both dark and light variants with the full token set', () => {
    for (const mode of ['dark', 'light'] as const) {
      const t = themes[mode];
      expect(t.bg).toBeDefined();
      expect(t.text).toBeDefined();
      expect(t.textSecondary).toBeDefined();
      expect(t.textTertiary).toBeDefined();
      expect(t.dot).toBeDefined();
      expect(t.border).toBeDefined();
      expect(t.accent).toBeDefined();
      expect(t.accentText).toBeDefined();
      expect(t.cardBorder).toBeDefined();
      expect(t.subtle).toBeDefined();
    }
  });

  it('uses terracotta accent in both modes (intentional)', () => {
    expect(themes.dark.accent).toBe(palette.terracotta);
    expect(themes.light.accent).toBe(palette.terracotta);
  });
});

describe('getStatusBarStyle', () => {
  it('accepts boolean isDark', () => {
    expect(getStatusBarStyle(true)).toBe('light');
    expect(getStatusBarStyle(false)).toBe('dark');
  });
  it('accepts ThemeMode strings', () => {
    expect(getStatusBarStyle('dark')).toBe('light');
    expect(getStatusBarStyle('light')).toBe('dark');
  });
});
