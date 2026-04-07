import { useEffect, useState } from 'react';
import { Image, StyleSheet, Text, View } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import Animated, {
  FadeIn,
  FadeOut,
  useSharedValue,
  useAnimatedStyle,
  withTiming,
} from 'react-native-reanimated';
import PillButton from '@/components/PillButton';
import { Fonts } from '@/constants/theme';

const PHRASES = [
  'Lying in the grass.',
  'Staring at clouds.',
  'Dreaming about nothing.',
  'Time just... stopped.',
];

const grassImage = require('@/assets/images/grass.png');

function Phrase({ text, visible }: { text: string; visible: boolean }) {
  const opacity = useSharedValue(0);

  useEffect(() => {
    if (visible) {
      opacity.value = withTiming(1, { duration: 800 });
    }
  }, [visible]);

  const animStyle = useAnimatedStyle(() => ({
    opacity: opacity.value,
  }));

  return <Animated.Text style={animStyle}>{text}</Animated.Text>;
}

interface Props {
  isActive: boolean;
  onNext: () => void;
  theme: { text: string; bg: string };
}

export default function NostalgiaScreen({ isActive, onNext, theme }: Props) {
  const insets = useSafeAreaInsets();
  const [phase, setPhase] = useState<'title' | 'body'>('title');
  const [visiblePhrases, setVisiblePhrases] = useState(0);
  const buttonOpacity = useSharedValue(0);

  useEffect(() => {
    if (!isActive) return;
    const timer = setTimeout(() => setPhase('body'), 3000);
    return () => clearTimeout(timer);
  }, [isActive]);

  useEffect(() => {
    if (phase !== 'body') return;
    let count = 0;
    const timer = setInterval(() => {
      count++;
      setVisiblePhrases(count);
      if (count >= PHRASES.length) {
        clearInterval(timer);
        setTimeout(() => {
          buttonOpacity.value = withTiming(1, { duration: 800 });
        }, 600);
      }
    }, 1200);
    return () => clearInterval(timer);
  }, [phase]);

  const buttonAnimStyle = useAnimatedStyle(() => ({
    opacity: buttonOpacity.value,
  }));

  return (
    <View style={[styles.container, { backgroundColor: theme.bg, paddingTop: insets.top + 20 }]}>
      <Animated.View
        entering={FadeIn.duration(1200)}
        style={styles.imageArea}
      >
        <Image source={grassImage} style={styles.image} />
      </Animated.View>

      <View style={styles.textArea}>
        {isActive && phase === 'title' && (
          <Animated.Text
            entering={FadeIn.duration(1000).delay(500)}
            exiting={FadeOut.duration(800)}
            style={[styles.title, { color: theme.text }]}
          >
            Remember{'\n'}being a kid?
          </Animated.Text>
        )}
        {isActive && phase === 'body' && (
          <Text style={[styles.body, { color: theme.text }]}>
            {PHRASES.map((phrase, i) => (
              <Phrase
                key={i}
                text={phrase + (i < PHRASES.length - 1 ? ' ' : '')}
                visible={i < visiblePhrases}
              />
            ))}
          </Text>
        )}
      </View>

      <Animated.View
        style={[styles.buttonArea, { paddingBottom: insets.bottom + 24 }, buttonAnimStyle]}
      >
        <PillButton label="Continue" onPress={onNext} color={theme.text} />
      </Animated.View>
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    paddingHorizontal: 32,
  },
  imageArea: {
    flex: 5,
    justifyContent: 'center',
    alignItems: 'center',
  },
  image: {
    width: 320,
    height: 320,
    resizeMode: 'contain',
  },
  textArea: {
    flex: 4,
    justifyContent: 'flex-start',
    alignItems: 'center',
    paddingTop: '12%',
  },
  title: {
    fontFamily: Fonts?.serif,
    fontSize: 42,
    fontWeight: '400',
    textAlign: 'center',
    lineHeight: 52,
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
