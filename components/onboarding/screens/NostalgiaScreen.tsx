import { useEffect, useMemo } from 'react';
import { StyleSheet, Text, useWindowDimensions, View } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import Animated, {
  useAnimatedStyle,
  useSharedValue,
  withDelay,
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
  { words: [{ text: 'whole' }, { text: 'afternoons' }, { text: 'in' }, { text: 'the' }, { text: 'grass.' }] },
  { words: [{ text: 'clouds' }, { text: 'drifting' }, { text: 'by.' }] },
  { words: [{ text: 'nowhere' }, { text: 'to' }, { text: 'be.' }] },
  { words: [{ text: 'time' }, { text: 'just…' }, { text: 'stopped.', strong: true }], paragraph: true },
];

// Idle breathing for the child illustration — barely perceptible, like the
// lock on HowItWorksScreen but slower, so the screen stays alive at rest.
const BREATH_PERIOD_MS = 4200;
const BREATH_SCALE = 0.03;

// The illustration arrives last, below the text: a beat after "stopped."
// lands, the whole picture rises from below with a soft fade — never
// clipped — while its growing slot pushes the text up to make room.
const IMAGE_BEAT_MS = 600;
const IMAGE_REVEAL_MS = 1100;
const IMAGE_RISE_PX = 56;

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
  // The image enters a beat after the final word starts surfacing.
  const lastLine = schedule[schedule.length - 1];
  const imageDelay = lastLine[lastLine.length - 1] + IMAGE_BEAT_MS;

  const breath = useSharedValue(0);
  const imgReveal = useSharedValue(0);

  useEffect(() => {
    if (!isActive) return;
    breath.value = withRepeat(
      withTiming(1, { duration: BREATH_PERIOD_MS, easing: EASE_IN_OUT }),
      -1,
      true,
    );
    imgReveal.value = withDelay(
      imageDelay,
      withTiming(1, { duration: IMAGE_REVEAL_MS, easing: EASE_IN_OUT }),
    );
  }, [isActive, imageDelay]);

  // The slot grows from 0 to the image's height — the centred column
  // re-centres, pushing the text up to make room.
  const imageWrapStyle = useAnimatedStyle(() => ({
    height: imageSize * imgReveal.value,
  }));

  // The picture itself: whole (never clipped), rising from below into its
  // slot while fading in.
  const imageStyle = useAnimatedStyle(() => ({
    opacity: imgReveal.value,
    transform: [
      { translateY: IMAGE_RISE_PX * (1 - imgReveal.value) },
      { scale: 1 + breath.value * BREATH_SCALE },
    ],
  }));

  return (
    <View
      style={[
        styles.container,
        {
          backgroundColor: theme.bg,
          paddingTop: insets.top + 32,
          paddingBottom: insets.bottom + 96,
        },
      ]}
    >
      {/* Same size as the body — the heading is just the first line of the
          story, not a separate title tier. */}
      <Text style={[onboardingText.story, { color: theme.text }]}>
        <Word text={HEADING} delay={HEADING_DELAY_MS} cadence={CADENCE} />
      </Text>

      <View>
        {LINES.map((line, li) => (
          <Text
            key={li}
            style={[
              onboardingText.story,
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

      {/* The illustration arrives last, below the words, rising whole from
          below while its slot pushes the text upward. */}
      <Animated.View style={[styles.imageWrap, imageWrapStyle]}>
        <Animated.Image
          source={grassImage}
          style={[{ width: imageSize, height: imageSize }, imageStyle]}
          resizeMode='contain'
          fadeDuration={0}
        />
      </Animated.View>
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
  imageWrap: {
    alignSelf: 'center',
    // Anchor to the TOP of the growing slot and never clip: the slot's top
    // edge drifts upward as the column re-centres, so the picture rides up
    // with it (plus its own rise) instead of unrolling downward.
    justifyContent: 'flex-start',
    alignItems: 'center',
  },
  paragraph: {
    marginTop: 20,
  },
});
