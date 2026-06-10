import { useEffect } from 'react';
import Animated, {
  useAnimatedStyle,
  useSharedValue,
  withDelay,
  withTiming,
} from 'react-native-reanimated';

import { EASE_OUT } from '@/constants/animations';
import { haptics } from '@/lib/haptics';
import { ONBOARDING_BODY_BOLD } from './textStyles';

// Word-by-word text reveal shared by the narrative onboarding story acts
// (nostalgia, rushing). Each word condenses into focus where it stands —
// opacity up while a slight oversize settles to 1 — so nothing slides in
// from anywhere. A selection tick lands with every word; `strong` words
// (the payoffs) come in bold with the firmer light tap.
//
// The same machinery carries opposite moods purely through its `Cadence`:
// a slow step + long fade reads as a memory, a fast step + short fade as
// the rush. Screens own their cadence; this module owns the mechanics.

export interface WordSpec {
  text: string;
  /** Bold payoff word — lands with a firmer haptic. */
  strong?: boolean;
}

export interface WordLine {
  words: WordSpec[];
  /** Extra space + pause above this line. */
  paragraph?: boolean;
  /** Per-line tempo override — e.g. a final line that lands slower. */
  stepMs?: number;
}

export interface Cadence {
  /** When the first word starts. */
  startMs: number;
  /** Gap between consecutive words. */
  wordStepMs: number;
  /** Extra beat at each line break. */
  linePauseMs: number;
  /** Extra breath above a `paragraph` line. */
  paragraphPauseMs: number;
  /** Each word's own fade-in. */
  fadeMs: number;
  /** Words start this much oversized and settle into place — "coming into focus". */
  settleScale: number;
}

/** Per-line, per-word reveal delays — one cadence over the whole block,
 *  pausing a beat at line breaks and longer at paragraph breaks. */
export function buildSchedule(lines: WordLine[], c: Cadence): number[][] {
  let t = c.startMs;
  return lines.map((line) => {
    if (line.paragraph) t += c.paragraphPauseMs;
    const step = line.stepMs ?? c.wordStepMs;
    const delays = line.words.map(() => {
      const d = t;
      t += step;
      return d;
    });
    t += c.linePauseMs;
    return delays;
  });
}

export function Word({
  text,
  delay,
  cadence,
  strong,
}: {
  text: string;
  delay: number;
  cadence: Cadence;
  strong?: boolean;
}) {
  const reveal = useSharedValue(0);

  useEffect(() => {
    reveal.value = withDelay(
      delay,
      withTiming(1, { duration: cadence.fadeMs, easing: EASE_OUT }),
    );
    const t = setTimeout(() => (strong ? haptics.light() : haptics.select()), delay);
    return () => clearTimeout(t);
  }, [delay, strong]);

  const style = useAnimatedStyle(() => ({
    opacity: reveal.value,
    transform: [
      { scale: cadence.settleScale - (cadence.settleScale - 1) * reveal.value },
    ],
  }));

  return (
    <Animated.Text style={[style, strong && ONBOARDING_BODY_BOLD]}>
      {text}{' '}
    </Animated.Text>
  );
}
