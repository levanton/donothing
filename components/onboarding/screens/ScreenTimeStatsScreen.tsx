import { useEffect, useMemo } from 'react';
import { Pressable, StyleSheet, Text, View } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import Animated, {
  Easing,
  useSharedValue,
  useAnimatedStyle,
  withTiming,
  withDelay,
} from 'react-native-reanimated';
import { EASE_OUT } from '@/constants/animations';
import { Fonts } from '@/constants/theme';
import { palette } from '@/lib/theme';


const HOURS_MAP: Record<string, number> = {
  '2–3h': 2.5,
  '4–5h': 4.5,
  '6–7h': 6.5,
  '8+': 8,
};

type Token = { word: string; accent: boolean; bold: boolean };

function buildLines(hoursPerDay: number): { text: string; accent: boolean; bold: boolean }[] {
  const hoursPerYear = Math.round(hoursPerDay * 365);
  const daysPerYear = Math.round(hoursPerYear / 24);
  const yearsLifetime = Math.round((hoursPerDay * 365 * 50) / 8760);

  return [
    { text: `That's`, accent: false, bold: false },
    { text: `~${hoursPerYear.toLocaleString()} hours`, accent: true, bold: true },
    { text: `on your phone this year.`, accent: false, bold: false },
    { text: `\n\n~${daysPerYear} full days.`, accent: true, bold: true },
    { text: `Gone.`, accent: false, bold: true },
    { text: `\n\nOver a lifetime,`, accent: false, bold: false },
    { text: `~${yearsLifetime} years`, accent: true, bold: true },
    { text: `of scrolling.`, accent: false, bold: false },
    { text: `\n\nWhat if you took just`, accent: false, bold: false },
    { text: `one minute`, accent: true, bold: true },
    { text: `back?`, accent: false, bold: false },
  ];
}

function Word({ text, delay, bold, accent }: { text: string; delay: number; bold?: boolean; accent?: boolean }) {
  const opacity = useSharedValue(0);
  const translateY = useSharedValue(10);

  useEffect(() => {
    opacity.value = withDelay(delay, withTiming(1, { duration: 700, easing: EASE_OUT }));
    translateY.value = withDelay(delay, withTiming(0, { duration: 700, easing: EASE_OUT }));
  }, []);

  const animStyle = useAnimatedStyle(() => ({
    opacity: opacity.value,
    transform: [{ translateY: translateY.value }],
  }));

  return (
    <Animated.Text
      style={[
        animStyle,
        bold && { fontWeight: '600' },
        accent && { color: palette.terracotta },
      ]}
    >
      {text}{' '}
    </Animated.Text>
  );
}

interface Props {
  isActive: boolean;
  onNext: () => void;
  screenTimeAnswer: string;
  theme: { text: string; bg: string };
}

export default function ScreenTimeStatsScreen({ isActive, onNext, screenTimeAnswer, theme }: Props) {
  const insets = useSafeAreaInsets();

  const hoursPerDay = HOURS_MAP[screenTimeAnswer] ?? 4.5;
  const lines = useMemo(() => buildLines(hoursPerDay), [hoursPerDay]);

  const allWords: Token[] = useMemo(() =>
    lines.flatMap(l =>
      l.text.split(' ').map(w => ({ word: w, bold: l.bold, accent: l.accent }))
    ), [lines]);

  const WORD_DELAY = 120;
  const totalWordsDuration = allWords.length * WORD_DELAY + 700;

  const buttonOpacity = useSharedValue(0);
  const buttonTranslateY = useSharedValue(12);

  useEffect(() => {
    if (!isActive) return;
    const t1 = setTimeout(() => {
      buttonOpacity.value = withTiming(1, { duration: 600, easing: EASE_OUT });
      buttonTranslateY.value = withTiming(0, { duration: 600, easing: EASE_OUT });
    }, totalWordsDuration + 200);
    return () => clearTimeout(t1);
  }, [isActive]);

  const buttonAnimStyle = useAnimatedStyle(() => ({
    opacity: buttonOpacity.value,
    transform: [{ translateY: buttonTranslateY.value }],
  }));

  return (
    <View style={[styles.container, { backgroundColor: theme.bg }]}>
      <View style={[styles.content, { paddingBottom: insets.bottom }]}>
        <View style={styles.centerArea}>
          <View style={styles.textArea}>
            <Text style={[styles.body, { color: theme.text }]}>
              {allWords.map((w, i) => (
                <Word key={i} text={w.word} delay={i * WORD_DELAY} bold={w.bold} accent={w.accent} />
              ))}
            </Text>
          </View>
        </View>

        <Animated.View style={[styles.buttonArea, { paddingBottom: 24 }, buttonAnimStyle]}>
          <Pressable onPress={onNext} style={styles.ctaButton}>
            <Text style={styles.ctaText}>
              Bring my minute back
            </Text>
          </Pressable>
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
  textArea: {},
  body: {
    fontFamily: Fonts?.serif,
    fontSize: 26,
    fontWeight: '400',
    textAlign: 'left',
    lineHeight: 38,
  },
  buttonArea: {
    alignItems: 'center',
  },
  ctaButton: {
    backgroundColor: palette.terracotta,
    borderRadius: 100,
    paddingVertical: 16,
    paddingHorizontal: 32,
  },
  ctaText: {
    fontFamily: Fonts?.serif,
    fontSize: 18,
    fontWeight: '400',
    color: palette.cream,
  },
});
