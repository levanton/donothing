import { useEffect, useState } from 'react';
import { Image, StyleSheet, Text, View } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import Animated, {
  useSharedValue,
  useAnimatedStyle,
  withTiming,
  withDelay,
} from 'react-native-reanimated';
import PillButton from '@/components/PillButton';
import { Fonts } from '@/constants/theme';

const BODY_TEXT = 'Lying in the grass. Staring at clouds. Dreaming about nothing.\nTime just... stopped.';
const WORDS = BODY_TEXT.split(' ');
const WORD_DELAY = 150; // ms between each word

const grassImage = require('@/assets/images/grass.png');

function Word({ text, delay }: { text: string; delay: number }) {
  const opacity = useSharedValue(0);

  useEffect(() => {
    opacity.value = withDelay(delay, withTiming(1, { duration: 400 }));
  }, []);

  const animStyle = useAnimatedStyle(() => ({
    opacity: opacity.value,
  }));

  return <Animated.Text style={animStyle}>{text} </Animated.Text>;
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
  const imageOpacity = useSharedValue(0);
  const buttonOpacity = useSharedValue(0);

  const totalWordsDuration = WORDS.length * WORD_DELAY + 400;

  useEffect(() => {
    if (!isActive) return;
    titleOpacity.value = withDelay(150, withTiming(1, { duration: 500 }));

    const t1 = setTimeout(() => {
      titleOpacity.value = withTiming(0, { duration: 400 });
    }, 1600);
    const t2 = setTimeout(() => {
      setShowBody(true);
      imageOpacity.value = withTiming(1, { duration: 600 });
    }, 2200);
    // Show button after all words have appeared
    const t3 = setTimeout(() => {
      buttonOpacity.value = withTiming(1, { duration: 500 });
    }, 2200 + totalWordsDuration + 300);
    return () => { clearTimeout(t1); clearTimeout(t2); clearTimeout(t3); };
  }, [isActive]);

  const titleStyle = useAnimatedStyle(() => ({
    opacity: titleOpacity.value,
  }));

  const imageStyle = useAnimatedStyle(() => ({
    opacity: imageOpacity.value,
  }));

  const buttonAnimStyle = useAnimatedStyle(() => ({
    opacity: buttonOpacity.value,
  }));

  return (
    <View style={[styles.container, { backgroundColor: theme.bg }]}>
      {/* Title — centered on full screen */}
      <Animated.View style={[styles.titleOverlay, titleStyle]}>
        <Text style={[styles.title, { color: theme.text }]}>
          Remember{'\n'}being a kid?
        </Text>
      </Animated.View>

      {/* Text first, then image below */}
      {showBody && (
        <View style={[styles.content, { paddingTop: insets.top + 40 }]}>
          <View style={styles.textArea}>
            <Text style={[styles.body, { color: theme.text }]}>
              {WORDS.map((word, i) => (
                <Word key={i} text={word} delay={i * WORD_DELAY} />
              ))}
            </Text>
          </View>

          <Animated.View style={[styles.imageArea, imageStyle]}>
            <Image source={grassImage} style={styles.image} />
          </Animated.View>

          <Animated.View
            style={[styles.buttonArea, { paddingBottom: insets.bottom + 24 }, buttonAnimStyle]}
          >
            <PillButton label="Continue" onPress={onNext} color={theme.text} outline />
          </Animated.View>
        </View>
      )}
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
    alignItems: 'center',
  },
  body: {
    fontFamily: Fonts?.serif,
    fontSize: 23,
    fontWeight: '400',
    textAlign: 'center',
    lineHeight: 34,
    paddingHorizontal: 8,
  },
  buttonArea: {
    alignItems: 'center',
  },
});
