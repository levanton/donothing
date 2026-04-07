import { useEffect, useState } from 'react';
import { Image, StyleSheet, Text, View } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import Animated, {
  Easing,
  useSharedValue,
  useAnimatedStyle,
  withTiming,
  withDelay,
} from 'react-native-reanimated';
import PillButton from '@/components/PillButton';
import { Fonts } from '@/constants/theme';

const rushImage = require('@/assets/images/rush.png');

const BODY_TEXT = 'Now you rush to work. Start a task. Run to the store. Cook. Clean. Fix. Reply. Pick up kids. Rush somewhere else.\nEven when you\'re not scrolling — you\'re rushing.';
const WORDS = BODY_TEXT.split(' ');
const WORD_DELAY = 200;

const EASE_OUT = Easing.bezier(0.25, 0.1, 0.25, 1);

function Word({ text, delay }: { text: string; delay: number }) {
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

  return <Animated.Text style={animStyle}>{text} </Animated.Text>;
}

interface Props {
  isActive: boolean;
  onNext: () => void;
  theme: { text: string; bg: string };
}

export default function RushingScreen({ isActive, onNext, theme }: Props) {
  const insets = useSafeAreaInsets();
  const [showBody, setShowBody] = useState(false);

  const titleOpacity = useSharedValue(0);
  const titleScale = useSharedValue(0.92);
  const imageOpacity = useSharedValue(0);
  const imageScale = useSharedValue(0.92);
  const buttonOpacity = useSharedValue(0);
  const buttonTranslateY = useSharedValue(12);

  const totalWordsDuration = WORDS.length * WORD_DELAY + 600;

  useEffect(() => {
    if (!isActive) return;
    // Title: fade in + scale up
    titleOpacity.value = withDelay(200, withTiming(1, { duration: 700, easing: EASE_OUT }));
    titleScale.value = withDelay(200, withTiming(1, { duration: 700, easing: EASE_OUT }));

    // Title: fade out + scale down
    const t1 = setTimeout(() => {
      titleOpacity.value = withTiming(0, { duration: 700, easing: EASE_OUT });
      titleScale.value = withTiming(0.92, { duration: 700, easing: EASE_OUT });
    }, 1800);
    // Show image + words
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
      {/* Title */}
      {!showBody && (
        <Animated.View style={[styles.titleOverlay, titleStyle]}>
          <Text style={[styles.title, { color: theme.text }]}>Now?</Text>
        </Animated.View>
      )}

      {/* Image on top, text below */}
      <View style={[styles.content, { paddingTop: insets.top, paddingBottom: insets.bottom, opacity: showBody ? 1 : 0 }]}>
        <View style={styles.centerArea}>
          <Animated.View style={[styles.imageArea, imageStyle]}>
            <Image source={rushImage} style={styles.image} fadeDuration={0} />
          </Animated.View>

          <View style={styles.textArea}>
            {showBody && (
              <Text style={[styles.body, { color: theme.text }]}>
                {WORDS.map((word, i) => (
                  <Word key={i} text={word} delay={i * WORD_DELAY} />
                ))}
              </Text>
            )}
          </View>
        </View>

        <Animated.View
          style={[styles.buttonArea, { paddingBottom: 24 }, buttonAnimStyle]}
        >
          <PillButton label="Continue" onPress={onNext} color={theme.text} outline />
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
  },
  title: {
    fontFamily: Fonts?.serif,
    fontSize: 38,
    fontWeight: '400',
    textAlign: 'center',
  },
  content: {
    flex: 1,
    paddingHorizontal: 32,
  },
  centerArea: {
    flex: 1,
    justifyContent: 'center',
  },
  imageArea: {
    alignItems: 'center',
    marginBottom: 24,
  },
  image: {
    width: 260,
    height: 260,
    resizeMode: 'contain',
  },
  textArea: {},
  body: {
    fontFamily: Fonts?.serif,
    fontSize: 23,
    fontWeight: '400',
    textAlign: 'left',
    lineHeight: 34,
  },
  buttonArea: {
    alignItems: 'center',
  },
});
