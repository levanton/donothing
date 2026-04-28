import { StyleSheet, View } from 'react-native';

import { palette } from '@/lib/theme';

/**
 * Single dot in a starscape — `top`/`bottom` + `left`/`right` are
 * passed through verbatim so callers can keep the exact same hand-
 * curated arrangement BlockSheet and SessionEndedSheet had.
 *
 * `tone` selects the colour family — `text` uses the active theme
 * text colour (so dots stay readable on light + dark sheets), while
 * `accent` uses the terracotta palette tone.
 */
interface Star {
  top?: number;
  bottom?: number;
  left?: number;
  right?: number;
  size: number;
  tone: 'text' | 'accent';
  opacity?: number;
}

interface StarscapeProps {
  /** Theme text colour — used as the base for `tone: 'text'` dots. */
  textColor: string;
  /** Which preset arrangement to render. */
  pattern: 'block' | 'pause';
}

// Hand-curated layouts pulled out of the previous inline JSX so the
// sheets keep the exact same dot positions. If you tweak one, edit
// here — both sheets get the change.
const BLOCK_STARS: Star[] = [
  { top: 4, left: 24, size: 3, tone: 'text', opacity: 0.5 },
  { top: 18, left: 62, size: 5, tone: 'accent' },
  { top: 36, left: 8, size: 4, tone: 'text', opacity: 0.35 },
  { top: 8, right: 30, size: 4, tone: 'text', opacity: 0.7 },
  { top: 48, right: 14, size: 3, tone: 'accent', opacity: 0.8 },
  { bottom: 18, left: 32, size: 5, tone: 'text', opacity: 0.4 },
  { bottom: 30, right: 48, size: 3, tone: 'accent', opacity: 0.6 },
  { bottom: 6, right: 20, size: 4, tone: 'text', opacity: 0.5 },
  { top: 60, left: 38, size: 2, tone: 'text', opacity: 0.4 },
  { top: 80, right: 60, size: 2, tone: 'accent', opacity: 0.7 },
  { bottom: 50, left: 18, size: 3, tone: 'accent', opacity: 0.5 },
  { bottom: 60, right: 8, size: 2, tone: 'text', opacity: 0.6 },
];

const PAUSE_STARS: Star[] = [
  { top: 6, left: 30, size: 3, tone: 'text', opacity: 0.5 },
  { top: 24, left: 70, size: 5, tone: 'accent' },
  { top: 44, left: 12, size: 4, tone: 'text', opacity: 0.35 },
  { top: 14, right: 36, size: 4, tone: 'text', opacity: 0.7 },
  { top: 48, right: 18, size: 3, tone: 'accent', opacity: 0.8 },
  { bottom: 22, left: 40, size: 5, tone: 'text', opacity: 0.4 },
  { bottom: 32, right: 52, size: 3, tone: 'accent', opacity: 0.6 },
  { bottom: 8, right: 24, size: 4, tone: 'text', opacity: 0.5 },
];

const PATTERNS = {
  block: BLOCK_STARS,
  pause: PAUSE_STARS,
} as const;

export default function Starscape({ textColor, pattern }: StarscapeProps) {
  const stars = PATTERNS[pattern];
  return (
    <>
      {stars.map((s, i) => (
        <View
          key={i}
          style={[
            styles.star,
            {
              top: s.top,
              bottom: s.bottom,
              left: s.left,
              right: s.right,
              width: s.size,
              height: s.size,
              backgroundColor: s.tone === 'accent' ? palette.terracotta : textColor,
              opacity: s.opacity,
            },
          ]}
        />
      ))}
    </>
  );
}

const styles = StyleSheet.create({
  star: {
    position: 'absolute',
    borderRadius: 100,
  },
});
