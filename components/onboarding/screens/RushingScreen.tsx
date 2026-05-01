import { useEffect } from 'react';
import { Image, Pressable, StyleSheet, Text, View } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import Animated, {
  useSharedValue,
  useAnimatedStyle,
  withTiming,
  withDelay,
} from 'react-native-reanimated';
import { EASE_OUT } from '@/constants/animations';
import { Feather } from '@expo/vector-icons';
import { Fonts } from '@/constants/theme';

const rushImage = require('@/assets/images/rush.png');

const HEADING = 'Now.';
const LINES = [
  { text: 'Work. Home. Errands. Repeat.', bold: false },
  { text: '\nIn between — we scroll.', bold: false },
  { text: '\nNot to feel something — but to feel nothing.', bold: false },
  { text: '\nAnd it never helps.', bold: false },
  { text: '\nWe’re exhausted.', bold: true },
  { text: '\nDays, months, years — gone in a blur.', bold: true },
];
const WORD_DELAY = 130;
const WORD_DURATION = 750;
const HEADING_DELAY = 200;
const HEADING_DURATION = 850;
const BODY_START = HEADING_DELAY + HEADING_DURATION;


function Word({ text, delay, bold }: { text: string; delay: number; bold?: boolean }) {
  const opacity = useSharedValue(0);
  const translateY = useSharedValue(12);

  useEffect(() => {
    opacity.value = withDelay(delay, withTiming(1, { duration: WORD_DURATION, easing: EASE_OUT }));
    translateY.value = withDelay(delay, withTiming(0, { duration: WORD_DURATION, easing: EASE_OUT }));
  }, []);

  const animStyle = useAnimatedStyle(() => ({
    opacity: opacity.value,
    transform: [{ translateY: translateY.value }],
  }));

  return <Animated.Text style={[animStyle, bold && { fontWeight: '600' }]}>{text} </Animated.Text>;
}

interface Props {
  isActive: boolean;
  onNext: () => void;
  theme: { text: string; bg: string };
}

export default function RushingScreen({ isActive, onNext, theme }: Props) {
  const insets = useSafeAreaInsets();

  const headingOpacity = useSharedValue(0);
  const headingTranslateY = useSharedValue(12);
  const imageOpacity = useSharedValue(0);
  const imageScale = useSharedValue(0.92);
  const buttonOpacity = useSharedValue(0);
  const buttonTranslateY = useSharedValue(12);

  const allWords = LINES.flatMap(l => l.text.split(' ').map(w => ({ word: w, bold: l.bold })));
  const totalWordsDuration = allWords.length * WORD_DELAY + WORD_DURATION;

  useEffect(() => {
    if (!isActive) return;
    headingOpacity.value = withDelay(HEADING_DELAY, withTiming(1, { duration: HEADING_DURATION, easing: EASE_OUT }));
    headingTranslateY.value = withDelay(HEADING_DELAY, withTiming(0, { duration: HEADING_DURATION, easing: EASE_OUT }));

    imageOpacity.value = withDelay(HEADING_DELAY, withTiming(1, { duration: 1100, easing: EASE_OUT }));
    imageScale.value = withDelay(HEADING_DELAY, withTiming(1, { duration: 1100, easing: EASE_OUT }));

    const t = setTimeout(() => {
      buttonOpacity.value = withTiming(1, { duration: 500, easing: EASE_OUT });
      buttonTranslateY.value = withTiming(0, { duration: 500, easing: EASE_OUT });
    }, BODY_START + totalWordsDuration + 200);
    return () => clearTimeout(t);
  }, [isActive]);

  const headingStyle = useAnimatedStyle(() => ({
    opacity: headingOpacity.value,
    transform: [{ translateY: headingTranslateY.value }],
  }));

  const imageStyle = useAnimatedStyle(() => ({
    opacity: imageOpacity.value,
    transform: [{ scale: imageScale.value }],
  }));

  const buttonAnimStyle = useAnimatedStyle(() => ({
    opacity: buttonOpacity.value,
    transform: [{ translateY: buttonTranslateY.value }],
  }));

  return (
    <View style={[styles.container, { backgroundColor: theme.bg }]}>
      <View style={[styles.content, { paddingTop: insets.top, paddingBottom: insets.bottom }]}>
        <View style={styles.centerStack}>
          <Animated.View style={[styles.imageArea, imageStyle]}>
            <Image source={rushImage} style={styles.image} fadeDuration={0} />
          </Animated.View>

          <View style={styles.textArea}>
            <Animated.Text style={[styles.heading, { color: theme.text }, headingStyle]}>
              {HEADING}
            </Animated.Text>
            <Text style={[styles.body, { color: theme.text }]}>
              {allWords.map((w, i) => (
                <Word key={i} text={w.word} delay={BODY_START + i * WORD_DELAY} bold={w.bold} />
              ))}
            </Text>
          </View>
        </View>

        <Animated.View style={[styles.buttonArea, buttonAnimStyle]}>
          <Pressable onPress={onNext} style={[styles.circleButton, { borderColor: theme.text }]}>
            <Feather name="arrow-right" size={22} color={theme.text} />
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
    paddingBottom: 24,
  },
  centerStack: {
    flex: 1,
    justifyContent: 'center',
  },
  imageArea: {
    alignItems: 'center',
    marginBottom: 56,
  },
  image: {
    width: 220,
    height: 220,
    resizeMode: 'contain',
  },
  textArea: {},
  heading: {
    fontFamily: Fonts?.serif,
    fontSize: 22,
    fontWeight: '500',
    textAlign: 'left',
    lineHeight: 30,
    marginBottom: 12,
  },
  body: {
    fontFamily: Fonts?.serif,
    fontSize: 18,
    fontWeight: '400',
    textAlign: 'left',
    lineHeight: 26,
  },
  buttonArea: {
    alignItems: 'flex-end',
  },
  circleButton: {
    width: 52,
    height: 52,
    borderRadius: 26,
    borderWidth: 1.5,
    alignItems: 'center',
    justifyContent: 'center',
  },
});
