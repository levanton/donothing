import { useEffect, useRef } from 'react';
import {
  StyleSheet,
  useWindowDimensions,
  View,
  type LayoutChangeEvent,
} from 'react-native';
import Animated, {
  useAnimatedStyle,
  useSharedValue,
  withDelay,
  withRepeat,
  withSequence,
  withTiming,
} from 'react-native-reanimated';

import { EASE_IN_OUT } from '@/constants/animations';
import {
  GLIDE_EASING,
  GLIDE_MS,
  LINE_HOLD_MS,
  TypedLine,
  typeText,
  type Seg,
} from '../TypeReveal';

// One flat column — 'remember?' is simply the first line, no separate
// heading tier, no empty lines; the air between lines comes from the
// taller line height alone.
const LINES: { segs: Seg[] }[] = [
  { segs: [{ text: 'remember?' }] },
  { segs: [{ text: 'whole afternoons in the grass.' }] },
  { segs: [{ text: 'clouds drifting by.' }] },
  { segs: [{ text: 'nowhere to be.' }] },
  { segs: [{ text: 'time just… ' }, { text: 'stopped.', strong: true }] },
];

// Teleprompter, letter by letter — the shared machinery lives in
// TypeReveal; this act only owns its content, pace and start moment.
const START_MS = 600;
// A memory types a touch slower than the base rhythm.
const LETTER_STEP = 62;
const LINE_HEIGHT = 38;

// Idle breathing for the child illustration — barely perceptible, like the
// lock on HowItWorksScreen but slower, so the screen stays alive at rest.
const BREATH_PERIOD_MS = 4200;
const BREATH_SCALE = 0.03;

// The illustration is the story's final "line": after the last hold it
// rises whole from below with a soft fade while the column makes its
// final, gentler glide.
const IMAGE_REVEAL_MS = 1100;
const IMAGE_RISE_PX = 56;
/** How much of the picture the glide finally pulls up to the focal line —
 *  0.5 would centre it fully; smaller keeps the block lower. */
const IMAGE_LIFT_FRACTION = 0.2;

const grassImage = require('@/assets/images/child.png');

// The whole typing/gliding timetable: the first line types right away;
// every later line gets hold → glide → type. Module-level: it depends only
// on the constants above, and StoryScreen reads the total duration off it
// to time the continue arrow.
const TIMETABLE = (() => {
  let t = START_MS;
  const lines = LINES.map((line, i) => {
    const glideAt = i === 0 ? 0 : t + LINE_HOLD_MS;
    const glideDur = i === 0 ? 0 : GLIDE_MS;
    const typed = typeText(line.segs, i === 0 ? t : glideAt + glideDur, LETTER_STEP);
    t = typed.end;
    return { words: typed.words, glideAt, glideDur };
  });
  return { lines, imageGlideAt: t + LINE_HOLD_MS };
})();

/** When the whole 'remember?' performance (text + picture) has finished. */
export const NOSTALGIA_DONE_MS = TIMETABLE.imageGlideAt + IMAGE_REVEAL_MS;

interface Props {
  isActive: boolean;
  onNext: () => void;
  theme: { text: string; bg: string };
}

export default function NostalgiaScreen({ isActive, theme }: Props) {
  const { width } = useWindowDimensions();
  // A bit bigger than before, but scales down on small screens.
  const imageSize = Math.min(width * 0.68, 280);
  const timetable = TIMETABLE;

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
      timetable.imageGlideAt,
      withTiming(1, { duration: IMAGE_REVEAL_MS, easing: EASE_IN_OUT }),
    );
  }, [isActive, timetable]);

  // ── The column's glide steps ──────────────────────────────────────────
  // Each element (heading, lines, picture) reports its slot inside the
  // block; once all are measured, the glides are scheduled between the
  // typing windows. While a line is being typed or read, the column is
  // perfectly still and moves as one rigid piece.
  const shift = useSharedValue(0);
  const slots = useRef<({ y: number; h: number } | null)[]>(
    Array(LINES.length + 1).fill(null),
  );
  const built = useRef(false);

  const buildGlides = () => {
    if (built.current || slots.current.some((s) => s === null)) return;
    built.current = true;
    const els = slots.current as { y: number; h: number }[];
    const centerOf = (i: number) => -(els[i].y + els[i].h / 2);

    // The first line types on the focal line.
    shift.value = centerOf(0);

    const steps = [];
    let prevEnd = 0;
    timetable.lines.forEach((line, i) => {
      if (i === 0) return; // born in place — no glide for the first line
      steps.push(
        withDelay(
          Math.max(line.glideAt - prevEnd, 0),
          withTiming(centerOf(i), {
            duration: line.glideDur,
            easing: GLIDE_EASING,
          }),
        ),
      );
      prevEnd = line.glideAt + line.glideDur;
    });
    // Final, gentler glide alongside the picture's fade-in — lifting it
    // fully to the focal line would crowd the text at the top, so it stops
    // at the picture's upper part.
    const img = els[els.length - 1];
    steps.push(
      withDelay(
        Math.max(timetable.imageGlideAt - prevEnd, 0),
        withTiming(-(img.y + imageSize * IMAGE_LIFT_FRACTION), {
          duration: IMAGE_REVEAL_MS,
          easing: EASE_IN_OUT,
        }),
      ),
    );
    shift.value = withSequence(...steps);
  };

  const onSlotLayout = (i: number) => (e: LayoutChangeEvent) => {
    const { y, height } = e.nativeEvent.layout;
    if (slots.current[i]) return; // keep the first (pre-animation) measurement
    slots.current[i] = { y, h: height };
    buildGlides();
  };

  const blockStyle = useAnimatedStyle(() => ({
    transform: [{ translateY: shift.value }],
  }));

  // The slot grows from 0 to the image's height below the last line.
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
    <View style={[styles.container, { backgroundColor: theme.bg }]}>
      {/* The anchor marks the focal line (a touch below the centre); every
          line is typed there, and the column glides up through it. */}
      <View style={styles.anchor}>
        <Animated.View style={blockStyle}>
          {LINES.map((line, li) => (
            <View key={li} onLayout={onSlotLayout(li)}>
              <TypedLine
                words={timetable.lines[li].words}
                color={theme.text}
                lineHeight={LINE_HEIGHT}
              />
            </View>
          ))}

          {/* The illustration arrives last, rising whole from below while
              the column makes its final glide. */}
          <Animated.View
            onLayout={onSlotLayout(LINES.length)}
            style={[styles.imageWrap, imageWrapStyle]}
          >
            <Animated.Image
              source={grassImage}
              style={[{ width: imageSize, height: imageSize }, imageStyle]}
              resizeMode='contain'
              fadeDuration={0}
            />
          </Animated.View>
        </Animated.View>
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
  },
  anchor: {
    position: 'absolute',
    // The focal line sits a touch below the true centre — text reads more
    // settled there, and the story has more room to drift up into.
    top: '55%',
    left: 32,
    right: 32,
  },
  imageWrap: {
    marginTop: 28,
    alignSelf: 'center',
    // Anchored to the top of its growing slot and never clipped.
    justifyContent: 'flex-start',
    alignItems: 'center',
  },
});
