/**
 * Single source of truth for the story's MEDIA ZONE — the band where the
 * RadialDots field ('now.' / 'what if…') and the child illustration
 * ('remember?') live. StoryScreen places the dot layer with it, the acts
 * place their media in it, and the teleprompter derives its focal line
 * from its top edge — so text and media can never collide.
 */
const CENTER_FRACTION = 0.66;
// Hand-tuned pixel nudge of the whole media zone.
const ZONE_NUDGE_PX = 10;

/** One timing for the scatter → rings morph on 'what if…'. */
export const DOT_MORPH_MS = 1200;

export function getDotFieldLayout(width: number, height: number) {
  const size = Math.min(width * 0.9, height * 0.44, 350) * 0.9;
  return {
    size,
    left: (width - size) / 2,
    /** The zone's top edge — the text column ends just above this. */
    lowTop: height * CENTER_FRACTION - size / 2 + ZONE_NUDGE_PX,
  };
}
