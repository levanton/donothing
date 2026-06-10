import { useEffect, useMemo } from 'react';
import { StyleSheet, Text, useWindowDimensions, View } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import Animated, {
  useAnimatedStyle,
  useSharedValue,
  withRepeat,
  withTiming,
} from 'react-native-reanimated';

import { EASE_IN_OUT } from '@/constants/animations';
import { onboardingText } from '../textStyles';
import { buildSchedule, Word, type Cadence, type WordLine } from '../WordReveal';

const HEADING = 'remember?';

// A memory's pace: slow steps, long overlapping fades — words melt in.
const CADENCE: Cadence = {
  startMs: 1000,
  wordStepMs: 240,
  linePauseMs: 300,
  paragraphPauseMs: 650,
  fadeMs: 1100,
  settleScale: 1.05,
};
const HEADING_DELAY_MS = 350;

const LINES: WordLine[] = [
  { words: [{ text: 'lying' }, { text: 'in' }, { text: 'the' }, { text: 'grass.' }] },
  { words: [{ text: 'staring' }, { text: 'at' }, { text: 'clouds.' }] },
  { words: [{ text: 'dreaming' }, { text: 'about' }, { text: 'nothing.' }] },
  { words: [{ text: 'time' }, { text: 'just…' }, { text: 'stopped.', strong: true }], paragraph: true },
];

// Idle breathing for the child illustration — barely perceptible, like the
// lock on HowItWorksScreen but slower, so the screen stays alive at rest.
const BREATH_PERIOD_MS = 4200;
const BREATH_SCALE = 0.03;

const grassImage = require('@/assets/images/child.png');

interface Props {
  isActive: boolean;
  onNext: () => void;
  theme: { text: string; bg: string };
}

export default function NostalgiaScreen({ isActive, theme }: Props) {
  const insets = useSafeAreaInsets();
  const { width } = useWindowDimensions();
  // A bit bigger than before, but scales down on small screens.
  const imageSize = Math.min(width * 0.68, 280);

  const schedule = useMemo(() => buildSchedule(LINES, CADENCE), []);

  const breath = useSharedValue(0);

  useEffect(() => {
    if (!isActive) return;
    breath.value = withRepeat(
      withTiming(1, { duration: BREATH_PERIOD_MS, easing: EASE_IN_OUT }),
      -1,
      true,
    );
  }, [isActive]);

  const imageStyle = useAnimatedStyle(() => ({
    transform: [{ scale: 1 + breath.value * BREATH_SCALE }],
  }));

  return (
    <View
      style={[
        styles.container,
        {
          backgroundColor: theme.bg,
          paddingTop: insets.top + 32,
          // Heavier bottom padding lifts the centred block above true middle,
          // trimming the dead air between the status bar and the illustration.
          paddingBottom: insets.bottom + 200,
        },
      ]}
    >
      <Animated.Image
        source={grassImage}
        style={[styles.image, { width: imageSize, height: imageSize }, imageStyle]}
        resizeMode='contain'
        fadeDuration={0}
      />

      <Text style={[onboardingText.heading, { color: theme.text }]}>
        <Word text={HEADING} delay={HEADING_DELAY_MS} cadence={CADENCE} />
      </Text>

      <View>
        {LINES.map((line, li) => (
          <Text
            key={li}
            style={[
              onboardingText.line,
              { color: theme.text },
              line.paragraph && styles.paragraph,
            ]}
          >
            {line.words.map((w, wi) => (
              <Word key={wi} text={w.text} delay={schedule[li][wi]} cadence={CADENCE} strong={w.strong} />
            ))}
          </Text>
        ))}
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    paddingHorizontal: 32,
    justifyContent: 'center',
    gap: 28,
  },
  image: {
    alignSelf: 'center',
  },
  paragraph: {
    marginTop: 20,
  },
});
