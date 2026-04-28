import { useEffect, useState } from 'react';
import { Image, Pressable, StyleSheet, Text, View } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import Animated, {
  Easing,
  useSharedValue,
  useAnimatedStyle,
  withTiming,
  withDelay,
} from 'react-native-reanimated';
import { EASE_OUT } from '@/constants/animations';
import { Feather } from '@expo/vector-icons';
import { Fonts } from '@/constants/theme';

const LINES = [
  { text: 'Lying in the grass.', bold: false },
  { text: 'Staring at clouds.', bold: false },
  { text: 'Dreaming about nothing.', bold: false },
  { text: '\nTime just was.', bold: false },
  { text: '\nTime just... stopped.', bold: true },
];
const WORD_DELAY = 280;

const grassImage = require('@/assets/images/grass.png');

function Word({ text, delay, bold }: { text: string; delay: number; bold?: boolean }) {
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

  return <Animated.Text style={[animStyle, bold && { fontWeight: '600' }]}>{text} </Animated.Text>;
}

interface Props {
  isActive: boolean;
  onNext: () => void;
  theme: { text: string; bg: string };
}

export default function NostalgiaScreen({ isActive, onNext, theme }: Props) {
  const insets = useSafeAreaInsets();
  const [showBody, setShowBody] = useState(false);

  const titleOpacity = useSharedValue(0);
  const titleScale = useSharedValue(0.92);
  const imageOpacity = useSharedValue(0);
  const imageScale = useSharedValue(0.92);
  const buttonOpacity = useSharedValue(0);
  const buttonTranslateY = useSharedValue(12);

  const allWords = LINES.flatMap(l => l.text.split(' ').map(w => ({ word: w, bold: l.bold })));
  const totalWordsDuration = allWords.length * WORD_DELAY + 600;

  useEffect(() => {
    if (!isActive) return;
    // Title: fade in + scale up
    titleOpacity.value = withDelay(200, withTiming(1, { duration: 700, easing: EASE_OUT }));
    titleScale.value = withDelay(200, withTiming(1, { duration: 700, easing: EASE_OUT }));

    // Title: fade out
    const t1 = setTimeout(() => {
      titleOpacity.value = withTiming(0, { duration: 700, easing: EASE_OUT });
      titleScale.value = withTiming(0.92, { duration: 700, easing: EASE_OUT });
    }, 1800);
    // Show body + image
    const t2 = setTimeout(() => {
      setShowBody(true);
      imageOpacity.value = withTiming(1, { duration: 1200, easing: EASE_OUT });
      imageScale.value = withTiming(1, { duration: 1200, easing: EASE_OUT });
    }, 2500);
    // Button
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
      {/* Title — centered on full screen */}
      {!showBody && (
        <Animated.View style={[styles.titleOverlay, titleStyle]}>
          <Text style={[styles.title, { color: theme.text }]}>
            Remember{'\n'}being a kid?
          </Text>
        </Animated.View>
      )}

      {/* Text + image — always mounted, hidden until showBody */}
      <View style={[styles.content, { paddingTop: insets.top + 40, opacity: showBody ? 1 : 0 }]}>
        <View style={styles.textArea}>
          {showBody && (
            <Text style={[styles.body, { color: theme.text }]}>
              {allWords.map((w, i) => (
                <Word key={i} text={w.word} delay={i * WORD_DELAY} bold={w.bold} />
              ))}
            </Text>
          )}
        </View>

        <Animated.View style={[styles.imageArea, imageStyle]}>
          <Image source={grassImage} style={styles.image} fadeDuration={0} />
        </Animated.View>

        <Animated.View
          style={[styles.buttonArea, { paddingBottom: insets.bottom + 24 }, buttonAnimStyle]}
        >
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
    fontSize: 38,
    fontWeight: '400',
    textAlign: 'center',
    lineHeight: 48,
  },
  content: {
    flex: 1,
    paddingHorizontal: 32,
  },
  imageArea: {
    flex: 1,
    justifyContent: 'flex-start',
    alignItems: 'center',
  },
  image: {
    width: 300,
    height: 300,
    resizeMode: 'contain',
  },
  textArea: {
    flex: 0.7,
    justifyContent: 'center',
  },
  body: {
    fontFamily: Fonts?.serif,
    fontSize: 21,
    fontWeight: '400',
    textAlign: 'left',
    lineHeight: 34,
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
