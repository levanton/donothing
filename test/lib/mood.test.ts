import {
  MOODS,
  MOOD_COLORS,
  MOOD_COLORS_ARRAY,
  getMoodColor,
} from '@/lib/mood';

describe('MOODS', () => {
  it('has the canonical ordered list', () => {
    expect(MOODS).toEqual(['still', 'lighter', 'refreshed', 'full']);
  });

  it('has a color for every mood key', () => {
    for (const m of MOODS) {
      expect(MOOD_COLORS[m]).toMatch(/^#[0-9A-Fa-f]{6}$/);
    }
  });

  it('exposes MOOD_COLORS_ARRAY in MOODS order', () => {
    expect(MOOD_COLORS_ARRAY).toEqual(MOODS.map((m) => MOOD_COLORS[m]));
  });
});

describe('getMoodColor', () => {
  it('returns the color for a known mood', () => {
    expect(getMoodColor('still')).toBe(MOOD_COLORS.still);
  });

  it('returns null for nullish input', () => {
    expect(getMoodColor(null)).toBeNull();
    expect(getMoodColor(undefined)).toBeNull();
    expect(getMoodColor('')).toBeNull();
  });

  it('returns null for unknown mood keys', () => {
    expect(getMoodColor('legacy-mood')).toBeNull();
  });
});
