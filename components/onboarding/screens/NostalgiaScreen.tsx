import { useEffect } from 'react';
import { StyleSheet, useWindowDimensions, View } from 'react-native';
import Animated, {
  useAnimatedStyle,
  useSharedValue,
  withDelay,
  withRepeat,
  withTiming,
} from 'react-native-reanimated';

import { EASE_IN_OUT } from '@/constants/animations';
import { getDotFieldLayout } from '../dotFieldLayout';
import { buildTimetable, TeleprompterColumn, type TypeLineSpec } from '../TypeReveal';

// One flat column — 'remember?' is simply the first line.
const LINES: TypeLineSpec[] = [
  { segs: [{ text: 'remember?' }] },
  { segs: [{ text: 'whole afternoons in the grass.' }] },
  { segs: [{ text: 'clouds drifting by.' }] },
  { segs: [{ text: 'nowhere to be.' }] },
  { segs: [{ text: 'time just… ' }, { text: 'stopped.', strong: true }] },
];

const START_MS = 600;
// A memory types a touch slower than the base rhythm.
const LETTER_STEP = 62;

const TIMETABLE = buildTimetable(LINES, START_MS, LETTER_STEP);

// Idle breathing for the child illustration — barely perceptible, like the
// lock on HowItWorksScreen but slower, so the screen stays alive at rest.
const BREATH_PERIOD_MS = 4200;
const BREATH_SCALE = 0.03;

// The picture appears in the MEDIA ZONE (the same band the dot field
// occupies on the other acts), in place, purely by opacity — the text
// never moves for it.
const IMAGE_REVEAL_MS = 1100;

const grassImage = require('@/assets/images/child.png');

/** When the whole 'remember?' performance (text + picture) has finished. */
export const NOSTALGIA_DONE_MS = TIMETABLE.finaleAt + IMAGE_REVEAL_MS;

interface Props {
  isActive: boolean;
  onNext: () => void;
  theme: { text: string; bg: string };
}

export default function NostalgiaScreen({ isActive, theme }: Props) {
  const { width, height } = useWindowDimensions();
  // The media zone — identical to where the dot field lives on 'now.' /
  // 'what if…', so the picture and the field always share one area.
  const zone = getDotFieldLayout(width, height);
  const imageSize = Math.min(zone.size, 280);

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
      TIMETABLE.finaleAt,
      withTiming(1, { duration: IMAGE_REVEAL_MS, easing: EASE_IN_OUT }),
    );
  }, [isActive]);

  // The picture fades in where it lives, breathing gently.
  const imageStyle = useAnimatedStyle(() => ({
    opacity: imgReveal.value,
    transform: [{ scale: 1 + breath.value * BREATH_SCALE }],
  }));

  return (
    <View style={[styles.container, { backgroundColor: theme.bg }]}>
      <TeleprompterColumn timetable={TIMETABLE} color={theme.text} />

      <View
        pointerEvents="none"
        style={[
          styles.mediaZone,
          {
            left: zone.left,
            top: zone.lowTop,
            width: zone.size,
            height: zone.size,
          },
        ]}
      >
        <Animated.Image
          source={grassImage}
          style={[{ width: imageSize, height: imageSize }, imageStyle]}
          resizeMode='contain'
          fadeDuration={0}
        />
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
  },
  mediaZone: {
    position: 'absolute',
    alignItems: 'center',
    justifyContent: 'center',
  },
});
