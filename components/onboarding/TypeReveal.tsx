import { useEffect } from 'react';
import { StyleSheet, View } from 'react-native';
import Animated, {
  Easing,
  useAnimatedStyle,
  useSharedValue,
  withDelay,
  withTiming,
} from 'react-native-reanimated';

import { haptics } from '@/lib/haptics';
import { ONBOARDING_BODY_BOLD, onboardingText } from './textStyles';

/**
 * Letter-by-letter teleprompter machinery shared by the story acts.
 *
 * The line being written always sits on the screen's focal line and the
 * eyes never chase anything: letters tick in one by one (a soft haptic on
 * each), the finished line holds for a beat, then the column makes one
 * short, soft glide up and the next line starts typing in the freed spot.
 * A paragraph break gets a longer glide — bigger distance, same calm.
 *
 * This module owns the letters and the shared rhythm constants; each act
 * builds its own timetable from them and drives its column's glides.
 */

export interface Seg {
  text: string;
  strong?: boolean;
}

export interface TypedLetter {
  ch: string;
  strong?: boolean;
  delay: number;
}
export type TypedWord = TypedLetter[];

export const LETTER_STEP_MS = 50;
export const LETTER_FADE_MS = 160;
/** The pause between a line finishing and the column gliding on. */
export const LINE_HOLD_MS = 500;
export const GLIDE_MS = 900;
export const GLIDE_PARAGRAPH_MS = 1300;
export const GLIDE_EASING = Easing.bezier(0.22, 1, 0.36, 1);

// Spaces keep the typing beat (the clock ticks through them) but are not
// rendered — words are laid out as unbreakable row groups so a line can
// never wrap mid-word.
export function typeText(
  segs: Seg[],
  startAt: number,
  stepMs: number = LETTER_STEP_MS,
): { words: TypedWord[]; end: number } {
  const words: TypedWord[] = [];
  let cur: TypedWord = [];
  let t = startAt;
  for (const seg of segs) {
    for (const ch of seg.text) {
      if (ch === ' ') {
        if (cur.length) {
          words.push(cur);
          cur = [];
        }
      } else {
        cur.push({ ch, strong: seg.strong, delay: t });
      }
      t += stepMs;
    }
  }
  if (cur.length) words.push(cur);
  return { words, end: t };
}

function Letter({
  ch,
  strong,
  delay,
  color,
  lineHeight,
}: TypedLetter & { color: string; lineHeight?: number }) {
  const reveal = useSharedValue(0);

  useEffect(() => {
    reveal.value = withDelay(
      delay,
      withTiming(1, { duration: LETTER_FADE_MS, easing: Easing.out(Easing.quad) }),
    );
    // The typewriter's tick — one per letter.
    const t = setTimeout(() => haptics.select(), delay);
    return () => clearTimeout(t);
  }, [delay]);

  const style = useAnimatedStyle(() => ({ opacity: reveal.value }));

  return (
    <Animated.Text
      style={[
        onboardingText.story,
        { color },
        lineHeight != null && { lineHeight },
        strong && ONBOARDING_BODY_BOLD,
        style,
      ]}
    >
      {ch}
    </Animated.Text>
  );
}

export function TypedLine({
  words,
  color,
  lineHeight,
}: {
  words: TypedWord[];
  color: string;
  /** Per-screen override of the story style's line height. */
  lineHeight?: number;
}) {
  return (
    <View style={styles.lineRow}>
      {words.map((word, wi) => (
        <View key={wi} style={styles.wordRow}>
          {word.map((l, li) => (
            <Letter key={li} {...l} color={color} lineHeight={lineHeight} />
          ))}
        </View>
      ))}
    </View>
  );
}

const styles = StyleSheet.create({
  lineRow: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    // Word gap — words are unbreakable groups, so spaces aren't rendered.
    columnGap: 7,
  },
  wordRow: {
    flexDirection: 'row',
  },
});
