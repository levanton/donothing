import { useRef } from 'react';
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
  withSequence,
  withTiming,
} from 'react-native-reanimated';

import { EASE_IN_OUT } from '@/constants/animations';
import { getDotFieldLayout } from '../dotFieldLayout';
import {
  GLIDE_EASING,
  GLIDE_MS,
  GLIDE_PARAGRAPH_MS,
  LINE_HOLD_MS,
  TypedLine,
  typeText,
  type Seg,
} from '../TypeReveal';

const HEADING = 'now.';

// The same teleprompter as 'remember?', with this act's own dramaturgy:
// the turn ("but never really here.") and the payoff line type slower —
// each letter a heavier beat.
const LINES: { segs: Seg[]; paragraph?: boolean; stepMs?: number }[] = [
  { segs: [{ text: 'one more task.' }] },
  { segs: [{ text: 'one more message.' }] },
  { segs: [{ text: 'one more day gone.' }] },
  { segs: [{ text: 'it keeps us busy.' }], paragraph: true },
  { segs: [{ text: 'but never really here.' }], stepMs: 65 },
  {
    segs: [{ text: 'days, months, years — gone in a blur.', strong: true }],
    paragraph: true,
    stepMs: 80,
  },
];

// The act rides in from below over DOT_MORPH_MS (1200) — typing starts
// after the ride has settled.
const HEADING_START_MS = 1400;

// The typing/gliding timetable. Module-level: StoryScreen reads the dot
// field's arrival moment and the total duration off it.
const TIMETABLE = (() => {
  const heading = typeText([{ text: HEADING }], HEADING_START_MS);
  let t = heading.end;
  const lines = LINES.map((line) => {
    const glideAt = t + LINE_HOLD_MS;
    const glideDur = line.paragraph ? GLIDE_PARAGRAPH_MS : GLIDE_MS;
    const typed = typeText(line.segs, glideAt + glideDur, line.stepMs);
    t = typed.end;
    return { words: typed.words, glideAt, glideDur };
  });
  return { heading: heading.words, lines, dotsGlideAt: t + LINE_HOLD_MS };
})();

/** When the dot field rises from below — right after the last line's hold. */
export const NOW_DOTS_DELAY_MS = TIMETABLE.dotsGlideAt;
/** The shared duration of the field's rise and the column's final push. */
export const NOW_DOTS_ENTER_MS = 1100;
/** When the whole 'now.' performance is over: the push has landed and the
 *  field's dots have finished trickling in (3200 = RadialDots' reveal). */
export const NOW_DONE_MS = NOW_DOTS_DELAY_MS + 3200;

/** Gap between the last text line and the top of the dot field. */
const TEXT_FIELD_GAP_PX = 56;

/** The focal line — must match styles.anchor top. */
const FOCAL_FRACTION = 0.55;

interface Props {
  isActive: boolean;
  onNext: () => void;
  theme: { text: string; bg: string };
}

export default function RushingScreen({ theme }: Props) {
  const { width, height } = useWindowDimensions();
  const fieldTop = getDotFieldLayout(width, height).lowTop;

  // ── The column's glide steps ──────────────────────────────────────────
  // Identical machinery to 'remember?': elements report their slots, then
  // the glides run between the typing windows. The final step fires
  // together with the dot field's rise — the column is pushed up so its
  // last line clears the field.
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

    // The heading types on the focal line.
    shift.value = centerOf(0);

    const steps = [];
    let prevEnd = 0;
    TIMETABLE.lines.forEach((line, i) => {
      steps.push(
        withDelay(
          Math.max(line.glideAt - prevEnd, 0),
          withTiming(centerOf(i + 1), {
            duration: line.glideDur,
            easing: GLIDE_EASING,
          }),
        ),
      );
      prevEnd = line.glideAt + line.glideDur;
    });
    // Final push, in one motion with the dot field rising from below: the
    // column's bottom lands a fixed gap above the field's top edge.
    const last = els[els.length - 1];
    const blockBottom = last.y + last.h;
    const anchorY = height * FOCAL_FRACTION;
    steps.push(
      withDelay(
        Math.max(TIMETABLE.dotsGlideAt - prevEnd, 0),
        withTiming(fieldTop - TEXT_FIELD_GAP_PX - anchorY - blockBottom, {
          duration: NOW_DOTS_ENTER_MS,
          easing: EASE_IN_OUT,
        }),
      ),
    );
    shift.value = withSequence(...steps);
  };

  const onSlotLayout = (i: number) => (e: LayoutChangeEvent) => {
    const { y, height: h } = e.nativeEvent.layout;
    if (slots.current[i]) return; // keep the first (pre-animation) measurement
    slots.current[i] = { y, h };
    buildGlides();
  };

  const blockStyle = useAnimatedStyle(() => ({
    transform: [{ translateY: shift.value }],
  }));

  return (
    <View style={[styles.container, { backgroundColor: theme.bg }]}>
      {/* The anchor marks the focal line; every line is typed there. */}
      <View style={styles.anchor}>
        <Animated.View style={blockStyle}>
          {/* Same size as the body — one uniform text block, no title tier. */}
          <View onLayout={onSlotLayout(0)} style={styles.heading}>
            <TypedLine words={TIMETABLE.heading} color={theme.text} />
          </View>

          {LINES.map((line, li) => (
            <View
              key={li}
              onLayout={onSlotLayout(li + 1)}
              style={line.paragraph && styles.paragraph}
            >
              <TypedLine words={TIMETABLE.lines[li].words} color={theme.text} />
            </View>
          ))}
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
    // The focal line — keep in sync with FOCAL_FRACTION.
    top: '55%',
    left: 32,
    right: 32,
  },
  heading: {
    marginBottom: 28,
  },
  paragraph: {
    marginTop: 20,
  },
});
