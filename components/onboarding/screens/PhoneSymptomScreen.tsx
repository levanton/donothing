import { useEffect, useState } from 'react';
import { Pressable, StyleSheet, Text, View } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import Animated, {
  Easing,
  useSharedValue,
  useAnimatedStyle,
  withTiming,
  withDelay,
} from 'react-native-reanimated';
import { Feather } from '@expo/vector-icons';
import { Fonts } from '@/constants/theme';
import { palette } from '@/lib/theme';

const EASE_OUT = Easing.bezier(0.25, 0.1, 0.25, 1);

const LINES = [
  { text: 'Your brain forgot how to just...', bold: false, accent: false },
  { text: '\nbe still.', bold: true, accent: false },
  { text: '\nYou scroll not to feel something — but to feel nothing.', bold: false, accent: false },
  { text: '\nAnd it\'s not working.', bold: true, accent: true },
];

const WORD_DELAY = 220;

function Word({ text, delay, bold, accent }: { text: string; delay: number; bold?: boolean; accent?: boolean }) {
  const opacity = useSharedValue(0);
  const translateY = useSharedValue(8);

  useEffect(() => {
    opacity.value = withDelay(delay, withTiming(1, { duration: 600, easing: EASE_OUT }));
    translateY.value = withDelay(delay, withTiming(0, { duration: 600, easing: EASE_OUT }));
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
  theme: { text: string; bg: string };
}

export default function PhoneSymptomScreen({ isActive, onNext, theme }: Props) {
  const insets = useSafeAreaInsets();
  const [showBody, setShowBody] = useState(false);

  const titleOpacity = useSharedValue(0);
  const titleScale = useSharedValue(0.92);
  const buttonOpacity = useSharedValue(0);
  const buttonTranslateY = useSharedValue(12);

  const allWords = LINES.flatMap(l =>
    l.text.split(' ').map(w => ({ word: w, bold: l.bold, accent: l.accent }))
  );
  const totalWordsDuration = allWords.length * WORD_DELAY + 600;

  useEffect(() => {
    if (!isActive) return;
    titleOpacity.value = withDelay(200, withTiming(1, { duration: 700, easing: EASE_OUT }));
    titleScale.value = withDelay(200, withTiming(1, { duration: 700, easing: EASE_OUT }));

    const t1 = setTimeout(() => {
      titleOpacity.value = withTiming(0, { duration: 700, easing: EASE_OUT });
      titleScale.value = withTiming(0.92, { duration: 700, easing: EASE_OUT });
    }, 1800);
    const t2 = setTimeout(() => {
      setShowBody(true);
    }, 2500);
    const t3 = setTimeout(() => {
      buttonOpacity.value = withTiming(1, { duration: 600, easing: EASE_OUT });
      buttonTranslateY.value = withTiming(0, { duration: 600, easing: EASE_OUT });
    }, 2500 + totalWordsDuration + 400);
    return () => { clearTimeout(t1); clearTimeout(t2); clearTimeout(t3); };
  }, [isActive]);

  const titleStyle = useAnimatedStyle(() => ({
    opacity: titleOpacity.value,
    transform: [{ scale: titleScale.value }],
  }));

  const buttonAnimStyle = useAnimatedStyle(() => ({
    opacity: buttonOpacity.value,
    transform: [{ translateY: buttonTranslateY.value }],
  }));

  return (
    <View style={[styles.container, { backgroundColor: theme.bg }]}>
      {!showBody && (
        <Animated.View style={[styles.titleOverlay, titleStyle]}>
          <Text style={[styles.title, { color: palette.terracotta }]}>
            stop.
          </Text>
        </Animated.View>
      )}

      <View style={[styles.content, { paddingBottom: insets.bottom, opacity: showBody ? 1 : 0 }]}>
        <View style={styles.centerArea}>
          <View style={styles.textArea}>
            {showBody && (
              <Text style={[styles.body, { color: theme.text }]}>
                {allWords.map((w, i) => (
                  <Word key={i} text={w.word} delay={i * WORD_DELAY} bold={w.bold} accent={w.accent} />
                ))}
              </Text>
            )}
          </View>
        </View>

        <Animated.View style={[styles.buttonArea, { paddingBottom: 24 }, buttonAnimStyle]}>
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
  titleOverlay: {
    ...StyleSheet.absoluteFillObject,
    justifyContent: 'center',
    alignItems: 'center',
    paddingHorizontal: 32,
  },
  title: {
    fontFamily: Fonts?.serif,
    fontSize: 48,
    fontWeight: '500',
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
    fontSize: 21,
    fontWeight: '400',
    textAlign: 'left',
    lineHeight: 32,
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
