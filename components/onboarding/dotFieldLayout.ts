/**
 * Single source of truth for where the shared RadialDots field sits on the
 * "now." / "what if…" screens. Both the route (which renders the absolute dot
 * layer) and the screens (which align their text against the field) read from
 * here, so the text and the field can never drift apart.
 *
 * The field lives in the lower band on "now." (text above it) and glides up
 * to the upper band on "what if…" (text below it).
 */
const LOW_CENTER_FRACTION = 0.62;
const HIGH_CENTER_FRACTION = 0.33;

/** How far the field travels between the bands, as a fraction of height. */
export const DOT_TRAVEL_FRACTION = LOW_CENTER_FRACTION - HIGH_CENTER_FRACTION;

/**
 * One timing for the scatter → rings morph, the field's travel between the
 * bands, and the "what if…" page riding along below it (transitions.ts).
 */
export const DOT_MORPH_MS = 1200;

export function getDotFieldLayout(width: number, height: number) {
  const size = Math.min(width * 0.9, height * 0.44, 350) * 0.9;
  const lowCenterY = height * LOW_CENTER_FRACTION;
  const highCenterY = height * HIGH_CENTER_FRACTION;
  return {
    size,
    left: (width - size) / 2,
    /** Top edge in the lower band ("now.") — its text ends just above this. */
    lowTop: lowCenterY - size / 2,
    /** Top edge in the upper band ("what if…") — its text starts below this. */
    highTop: highCenterY - size / 2,
  };
}
