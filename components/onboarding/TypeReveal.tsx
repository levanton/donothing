import { useEffect, useRef } from 'react';
import {
  StyleSheet,
  useWindowDimensions,
  View,
  type LayoutChangeEvent,
} from 'react-native';
import Animated, {
  Easing,
  useAnimatedStyle,
  useSharedValue,
  withDelay,
  withSequence,
  withTiming,
} from 'react-native-reanimated';

import { haptics } from '@/lib/haptics';
import { palette } from '@/lib/theme';
import { getDotFieldLayout } from './dotFieldLayout';
import { ONBOARDING_BODY_BOLD, onboardingText } from './textStyles';

/**
 * Letter-by-letter teleprompter machinery shared by the story acts.
 *
 * The line being written always sits on the screen's focal line and the
 * eyes never chase anything: letters tick in one by one (a soft haptic on
 * each), the finished line holds for a beat, then the column makes one
 * short, soft glide up and the next line starts typing in the freed spot.
 *
 * The screen is split into fixed ZONES: the text zone (the column, focal
 * line a fixed gap above the media zone — identical on every act) and the
 * media zone below (the picture / the dot field — see getDotFieldLayout).
 * Media arriving in its zone NEVER moves the text. Each act builds its
 * timetable with `buildTimetable` (content + pace + start moment) and
 * renders a `TeleprompterColumn`; `finaleAt` is when the act's media
 * makes its entrance — one hold after the last line.
 */

export interface Seg {
  text: string;
  strong?: boolean;
  /** Render this segment in the brand terracotta. */
  accent?: boolean;
}

export interface TypeLineSpec {
  segs: Seg[];
  /** Per-line tempo override — e.g. a payoff line that types heavier. */
  stepMs?: number;
}

export interface TypedLetter {
  ch: string;
  strong?: boolean;
  accent?: boolean;
  delay: number;
}
export type TypedWord = TypedLetter[];

export const LETTER_STEP_MS = 50;
export const LETTER_FADE_MS = 160;
/** The pause between a line finishing and the column gliding on. */
export const LINE_HOLD_MS = 500;
export const GLIDE_MS = 900;
// A pronounced S-curve: the column leans into the move, sweeps through the
// middle and settles softly — clearly a curve, never a constant-speed slide.
export const GLIDE_EASING = Easing.bezier(0.65, 0, 0.35, 1);
/** Gap between the active (focal) line's bottom edge and the top of the
 *  media zone — the focal line is DERIVED from the zone, so the text can
 *  never collide with the picture / the dot field on any screen. */
const TEXT_ZONE_GAP_PX = 54;
export const STORY_LINE_HEIGHT = 38;

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
        cur.push({ ch, strong: seg.strong, accent: seg.accent, delay: t });
      }
      t += stepMs;
    }
  }
  if (cur.length) words.push(cur);
  return { words, end: t };
}

export interface TimetableLine {
  words: TypedWord[];
  glideAt: number;
  glideDur: number;
}
export interface TypeTimetable {
  lines: TimetableLine[];
  /** When the last line has finished typing. */
  end: number;
  /** When the act's finale fires — one hold after the last line. */
  finaleAt: number;
}

/** The act's full schedule: the first line types right away; every later
 *  line gets hold → glide → type. */
export function buildTimetable(
  lines: TypeLineSpec[],
  startMs: number,
  stepMs: number = LETTER_STEP_MS,
): TypeTimetable {
  let t = startMs;
  const typed = lines.map((line, i) => {
    const glideAt = i === 0 ? 0 : t + LINE_HOLD_MS;
    const glideDur = i === 0 ? 0 : GLIDE_MS;
    const out = typeText(line.segs, i === 0 ? t : glideAt + glideDur, line.stepMs ?? stepMs);
    t = out.end;
    return { words: out.words, glideAt, glideDur };
  });
  return { lines: typed, end: t, finaleAt: t + LINE_HOLD_MS };
}

function Letter({
  ch,
  strong,
  accent,
  delay,
  color,
  lineHeight,
}: TypedLetter & { color: string; lineHeight: number }) {
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
        { color: accent ? palette.terracotta : color, lineHeight },
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
  lineHeight = STORY_LINE_HEIGHT,
}: {
  words: TypedWord[];
  color: string;
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

/**
 * The column itself: renders the timetable's lines, measures every slot,
 * and drives the glides between the typing windows. While a line is being
 * typed or read the column is perfectly still, and it always moves as one
 * rigid piece. It lives entirely in the text zone — whatever appears in
 * the media zone below never moves it.
 */
export function TeleprompterColumn({
  timetable,
  color,
  lineHeight = STORY_LINE_HEIGHT,
}: {
  timetable: TypeTimetable;
  color: string;
  lineHeight?: number;
}) {
  const shift = useSharedValue(0);
  const slots = useRef<({ y: number; h: number } | null)[]>(
    Array(timetable.lines.length).fill(null),
  );
  const built = useRef(false);

  const buildGlides = () => {
    if (built.current || slots.current.some((s) => s === null)) return;
    built.current = true;
    const els = slots.current as { y: number; h: number }[];
    const centerOf = (i: number) => -(els[i].y + els[i].h / 2);

    // The first line types on the focal line.
    shift.value = centerOf(0);

    // Reanimated types animation factories as the animated value itself.
    const steps: number[] = [];
    let prevEnd = 0;
    timetable.lines.forEach((line, i) => {
      if (i === 0) return; // born in place — no glide for the first line
      steps.push(
        withDelay(
          Math.max(line.glideAt - prevEnd, 0),
          withTiming(centerOf(i), { duration: line.glideDur, easing: GLIDE_EASING }),
        ),
      );
      prevEnd = line.glideAt + line.glideDur;
    });
    if (steps.length) shift.value = withSequence(...steps);
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

  // The focal line sits a fixed gap above the media zone's top edge.
  const { width, height } = useWindowDimensions();
  const focalY =
    getDotFieldLayout(width, height).lowTop - TEXT_ZONE_GAP_PX - lineHeight / 2;

  return (
    <View style={[styles.anchor, { top: focalY }]}>
      <Animated.View style={blockStyle}>
        {timetable.lines.map((line, li) => (
          <View key={li} onLayout={onSlotLayout(li)}>
            <TypedLine words={line.words} color={color} lineHeight={lineHeight} />
          </View>
        ))}
      </Animated.View>
    </View>
  );
}

const styles = StyleSheet.create({
  anchor: {
    // The text zone's focal line — `top` is derived from the media zone.
    position: 'absolute',
    left: 32,
    right: 32,
  },
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
