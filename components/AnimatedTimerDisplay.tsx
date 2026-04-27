import { memo, useEffect, useState } from 'react';
import { StyleSheet, Text, View } from 'react-native';
import Animated, {
  Easing,
  useAnimatedStyle,
  useSharedValue,
  withSequence,
  withTiming,
} from 'react-native-reanimated';

import { Fonts } from '@/constants/theme';
import { timerDisplay } from '@/lib/format';

// "Punch" transition for the running-screen timer. When a digit
// changes, its cell briefly scales down, the value swaps at the
// trough, then the cell springs back to full size. Only ONE glyph is
// visible at any moment — no crossfade, no two-glyph overlap, no
// fade-to-transparent midpoint that reads as a blink.
//
// PUNCH_MIN is intentionally close to 1 — the smaller the trough,
// the gentler the motion reads. 0.95 is whisper-soft; the eye sees a
// gentle press rather than a punch.
const PUNCH_IN_MS = 240;
const PUNCH_OUT_MS = 380;
const PUNCH_MIN = 0.95;

interface DigitProps {
  char: string;
  color: string;
  fontSize: number;
  width: number;
}

const AnimatedDigit = memo(function AnimatedDigit({
  char, color, fontSize, width,
}: DigitProps) {
  const [displayed, setDisplayed] = useState(char);
  const scale = useSharedValue(1);

  useEffect(() => {
    if (char === displayed) return;
    // The colon never changes shape; swap silently when the slot's
    // role shifts (e.g. format change MM:SS → H:MM:SS).
    if (char === ':' || displayed === ':') {
      setDisplayed(char);
      return;
    }
    scale.value = withSequence(
      withTiming(PUNCH_MIN, {
        duration: PUNCH_IN_MS,
        easing: Easing.in(Easing.quad),
      }),
      withTiming(1, {
        duration: PUNCH_OUT_MS,
        easing: Easing.out(Easing.cubic),
      }),
    );
    // Swap at the trough so the new value rises into full size, the
    // old value departs at full size — neither is ever rendered at
    // partial scale of the other.
    const swap = setTimeout(() => setDisplayed(char), PUNCH_IN_MS);
    return () => clearTimeout(swap);
  }, [char]);

  const cellStyle = useAnimatedStyle(() => ({
    transform: [{ scale: scale.value }],
  }));

  return (
    <Animated.View
      style={[
        styles.cell,
        { width, height: fontSize * 1.15 },
        cellStyle,
      ]}
    >
      <Text
        style={[
          styles.text,
          {
            color,
            fontSize,
            fontFamily: Fonts!.mono,
            width,
            lineHeight: fontSize * 1.1,
          },
        ]}
      >
        {displayed}
      </Text>
    </Animated.View>
  );
});

interface Props {
  seconds: number;
  color: string;
  fontSize?: number;
}

const AnimatedTimerDisplay = memo(function AnimatedTimerDisplay({
  seconds, color, fontSize = 96,
}: Props) {
  const text = timerDisplay(seconds);
  const chars = text.split('');
  // Uniform advance for every glyph (digits AND the colon) so the
  // gap left of the colon matches the gap right of it. Mono fonts
  // with tabular-nums have equal advance widths anyway; matching
  // the colon to that advance makes the spacing visually symmetric.
  const cellWidth = fontSize * 0.62;

  return (
    <View style={styles.row}>
      {chars.map((ch, i) => (
        <AnimatedDigit
          key={i}
          char={ch}
          color={color}
          fontSize={fontSize}
          width={cellWidth}
        />
      ))}
    </View>
  );
});

export default AnimatedTimerDisplay;

const styles = StyleSheet.create({
  row: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
  },
  cell: {
    alignItems: 'center',
    justifyContent: 'center',
  },
  text: {
    fontWeight: '200',
    fontVariant: ['tabular-nums'],
    textAlign: 'center',
  },
});
