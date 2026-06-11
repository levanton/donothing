import { useEffect, useMemo } from 'react';
import { StyleSheet, View } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import Animated, {
  useSharedValue,
  useAnimatedStyle,
  withTiming,
} from 'react-native-reanimated';

import { EASE_OUT } from '@/constants/animations';
import CtaButton from '../CtaButton';
import { TypedLine, typeText, type Seg, type TypedWord } from '../TypeReveal';

const HOURS_MAP: Record<string, number> = {
  '2–3h': 2.5,
  '4–5h': 4.5,
  '6–7h': 6.5,
  '8+': 8,
};

// Approximate years remaining, assuming an ~80-year lifespan and the
// midpoint of each bucket. Used to personalize the "scrolling over your
// remaining years" stat — younger users see a bigger number.
const YEARS_LEFT_MAP: Record<string, number> = {
  'Under 18': 65,
  '18–24': 58,
  '25–34': 50,
  '35–44': 40,
  '45–54': 30,
  '55+': 20,
};
const DEFAULT_YEARS_LEFT = 50;

// The same letter-by-letter typing as the story acts, deliberately slower —
// these numbers should land one keystroke at a time. Paragraphs are typed
// in sequence with a breath between them.
const START_MS = 800;
const LETTER_STEP = 55;
const PARAGRAPH_PAUSE_MS = 250;

/** Keep an accent stat (e.g. "~2 373 hours") on one line — NBSP makes the
 *  whole phrase a single unbreakable "word" for the renderer. */
const nb = (s: string) => s.replace(/ /g, ' ');

/** The punch after the years-on-screen number — a life-sized comparison
 *  matched to the magnitude, so it's always honest: a light user sees a
 *  degree, a heavy young user sees more than a childhood. */
function comparisonFor(years: number): string {
  if (years >= 18) return 'more than your whole childhood.';
  if (years >= 14) return 'a whole childhood.';
  if (years >= 9) return 'all your school years.';
  if (years >= 5) return 'your entire teens.';
  return 'a whole university degree.';
}

function buildParagraphs(hoursPerDay: number, yearsLeft: number): Seg[][] {
  const hoursPerYear = Math.round(hoursPerDay * 365);
  const daysPerYear = Math.round(hoursPerYear / 24);
  const yearsScrollingLeft = Math.round((hoursPerDay * 365 * yearsLeft) / 8760);

  return [
    [
      { text: `That's ` },
      { text: nb(`~${hoursPerYear.toLocaleString()} hours`), accent: true, strong: true },
      { text: ` on your phone this year.` },
    ],
    [
      { text: nb(`~${daysPerYear} full days.`), accent: true, strong: true },
      { text: ` ` },
      { text: `Gone.`, strong: true },
    ],
    [
      { text: `Over your next ~${yearsLeft} years — ` },
      { text: nb(`~${yearsScrollingLeft} years`), accent: true, strong: true },
      { text: `. ` },
      { text: comparisonFor(yearsScrollingLeft), strong: true },
    ],
    [
      { text: `What if you took just ` },
      { text: nb(`one minute`), accent: true, strong: true },
      { text: ` back?` },
    ],
  ];
}

interface Props {
  isActive: boolean;
  onNext: () => void;
  screenTimeAnswer: string;
  ageAnswer: string;
  theme: { text: string; bg: string };
}

export default function ScreenTimeStatsScreen({
  isActive,
  onNext,
  screenTimeAnswer,
  ageAnswer,
  theme,
}: Props) {
  const insets = useSafeAreaInsets();

  const hoursPerDay = HOURS_MAP[screenTimeAnswer] ?? 4.5;
  const yearsLeft = YEARS_LEFT_MAP[ageAnswer] ?? DEFAULT_YEARS_LEFT;

  // Type the paragraphs one after another, a breath between each.
  const { paragraphs, doneAt } = useMemo(() => {
    let t = START_MS;
    const typed: TypedWord[][] = buildParagraphs(hoursPerDay, yearsLeft).map(
      (segs) => {
        const out = typeText(segs, t, LETTER_STEP);
        t = out.end + PARAGRAPH_PAUSE_MS;
        return out.words;
      },
    );
    return { paragraphs: typed, doneAt: t - PARAGRAPH_PAUSE_MS };
  }, [hoursPerDay, yearsLeft]);

  const buttonOpacity = useSharedValue(0);
  const buttonTranslateY = useSharedValue(12);

  useEffect(() => {
    if (!isActive) return;
    const t1 = setTimeout(() => {
      buttonOpacity.value = withTiming(1, { duration: 600, easing: EASE_OUT });
      buttonTranslateY.value = withTiming(0, { duration: 600, easing: EASE_OUT });
    }, doneAt + 300);
    return () => clearTimeout(t1);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [isActive, doneAt]);

  const buttonAnimStyle = useAnimatedStyle(() => ({
    opacity: buttonOpacity.value,
    transform: [{ translateY: buttonTranslateY.value }],
  }));

  return (
    <View style={[styles.container, { backgroundColor: theme.bg }]}>
      <View style={[styles.content, { paddingBottom: insets.bottom }]}>
        <View style={styles.centerArea}>
          <View style={styles.textArea}>
            {paragraphs.map((words, i) => (
              <TypedLine key={i} words={words} color={theme.text} />
            ))}
          </View>
        </View>

        <Animated.View style={[styles.buttonArea, { paddingBottom: 24 }, buttonAnimStyle]}>
          <CtaButton label="bring my minute back" onPress={onNext} variant="filled" />
        </Animated.View>
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
  },
  content: {
    flex: 1,
    paddingHorizontal: 32,
  },
  centerArea: {
    flex: 1,
    justifyContent: 'center',
  },
  textArea: {
    gap: 18,
  },
  buttonArea: {
    alignItems: 'center',
  },
});
