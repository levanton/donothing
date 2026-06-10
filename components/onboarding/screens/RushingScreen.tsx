import {
  StyleSheet,
  Text,
  useWindowDimensions,
  View,
  type LayoutChangeEvent,
} from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import Animated, {
  useAnimatedStyle,
  useSharedValue,
  withDelay,
  withTiming,
} from 'react-native-reanimated';

import { EASE_IN_OUT } from '@/constants/animations';
import { onboardingText } from '../textStyles';
import { getDotFieldLayout } from '../dotFieldLayout';
import { buildSchedule, Word, type Cadence, type WordLine } from '../WordReveal';

const HEADING = 'now.';

// The rush, embodied: whole lines drop in fast, one after another, like
// items on a to-do list that never ends — the opposite of the nostalgia
// screen's lazy word-by-word melt. Line-sized pieces keep it punchy without
// reading as jittery fragments.
const CADENCE: Cadence = {
  startMs: 800,
  wordStepMs: 170,
  linePauseMs: 560,
  paragraphPauseMs: 620,
  fadeMs: 750,
  settleScale: 1.03,
};
const HEADING_DELAY_MS = 300;

// Word tempo for the two lines that slow down for emphasis.
const EMPHASIS_STEP_MS = 320;

const LINES: WordLine[] = [
  { words: [{ text: 'one' }, { text: 'more' }, { text: 'task.' }] },
  { words: [{ text: 'one' }, { text: 'more' }, { text: 'message.' }] },
  { words: [{ text: 'one' }, { text: 'more' }, { text: 'day' }, { text: 'gone.' }] },
  { words: [{ text: 'it' }, { text: 'keeps' }, { text: 'us' }, { text: 'busy.' }], paragraph: true },
  // The turn: slower, each word a small admission.
  {
    words: [{ text: 'but' }, { text: 'never' }, { text: 'really' }, { text: 'here.' }],
    stepMs: EMPHASIS_STEP_MS,
  },
  // The payoff: three heavy beats, then the whole truth at once.
  {
    words: [
      { text: 'days,', strong: true },
      { text: 'months,', strong: true },
      { text: 'years —', strong: true },
      { text: 'gone in a blur.', strong: true },
    ],
    paragraph: true,
    stepMs: EMPHASIS_STEP_MS,
  },
];

// Module-level: LINES/CADENCE are constants, so the schedule is too.
const SCHEDULE = buildSchedule(LINES, CADENCE);
const LAST_LINE = SCHEDULE[SCHEDULE.length - 1];
/** When the act's last word starts surfacing. */
export const NOW_LAST_WORD_MS = LAST_LINE[LAST_LINE.length - 1];

// Mirrors the 'remember?' act: the text plays out centred, then a beat
// after the last words land the dot field rises from below — and pushes
// the text up to its place right above the field. StoryScreen (which owns
// the field) and this act both time off these exports so the push and the
// rise are one motion.
export const NOW_DOTS_DELAY_MS = NOW_LAST_WORD_MS + 600;
export const NOW_DOTS_ENTER_MS = 1100;

/** Gap between the last text line and the top of the dot field. */
const TEXT_FIELD_GAP_PX = 56;

interface Props {
  isActive: boolean;
  onNext: () => void;
  theme: { text: string; bg: string };
}

export default function RushingScreen({ theme }: Props) {
  const insets = useSafeAreaInsets();
  const { width, height } = useWindowDimensions();
  const fieldTop = getDotFieldLayout(width, height).lowTop;

  // How far the centred block must glide up to clear the arriving field.
  const shift = useSharedValue(0);

  const onBlockLayout = (e: LayoutChangeEvent) => {
    const { y, height: blockH } = e.nativeEvent.layout;
    // The act root fills the screen, so layout y is in screen coordinates.
    const target = fieldTop - TEXT_FIELD_GAP_PX - (y + blockH);
    if (target >= 0) return; // already clear of the field — no push needed
    shift.value = withDelay(
      NOW_DOTS_DELAY_MS,
      withTiming(target, { duration: NOW_DOTS_ENTER_MS, easing: EASE_IN_OUT }),
    );
  };

  const blockStyle = useAnimatedStyle(() => ({
    transform: [{ translateY: shift.value }],
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
      <Animated.View onLayout={onBlockLayout} style={blockStyle}>
        {/* Same size as the body — one uniform text block, no title tier. */}
        <Text style={[onboardingText.story, styles.heading, { color: theme.text }]}>
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
                <Word key={wi} text={w.text} delay={SCHEDULE[li][wi]} cadence={CADENCE} strong={w.strong} />
              ))}
            </Text>
          ))}
        </View>
      </Animated.View>
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    paddingHorizontal: 32,
    // Centred like the 'remember?' act — the arriving dot field pushes the
    // block up from here.
    justifyContent: 'center',
  },
  heading: {
    marginBottom: 14,
  },
  paragraph: {
    marginTop: 18,
  },
});
