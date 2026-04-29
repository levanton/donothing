// Single source of truth for mood keys, labels, and colors.
//
// Touch this file alone to rename a mood, swap a color, or reorder
// the dial — every UI surface (MoodDial, journey list, future
// stats) reads from here. The Record<MoodKey, string> shape gives
// TypeScript leverage to flag any consumer that's missing a mood
// when you add or rename one.

export const MOODS = ['still', 'lighter', 'refreshed', 'full'] as const;
export type MoodKey = (typeof MOODS)[number];

export const MOOD_COLORS: Record<MoodKey, string> = {
  still:     '#C9BBA3', // pale warm taupe
  lighter:   '#D4A66B', // warm ochre
  refreshed: '#A6C2B8', // pale dusty teal
  full:      '#8FA07A', // sage
};

// Array form ordered by MOODS — needed by reanimated's
// interpolateColor on the mood-dial fill.
export const MOOD_COLORS_ARRAY: readonly string[] = MOODS.map((m) => MOOD_COLORS[m]);

// Lookup that tolerates legacy/unknown mood strings from the DB.
// Returns null when the mood isn't recognized so the caller can
// decide on a fallback color.
export function getMoodColor(mood: string | null | undefined): string | null {
  if (!mood) return null;
  return (MOOD_COLORS as Record<string, string>)[mood] ?? null;
}
