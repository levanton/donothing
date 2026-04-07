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

const PHRASES = [
  'Lying in the grass.',
  'Staring at clouds.',
  'Dreaming about nothing.',
  '\nTime just... stopped.',
];

const grassImage = require('@/assets/images/grass.png');

function Phrase({ text, visible, bold }: { text: string; visible: boolean; bold?: boolean }) {
  const opacity = useSharedValue(0);

  useEffect(() => {
    if (visible) {
      opacity.value = withTiming(1, { duration: 800 });
    }
  }, [visible]);

  const animStyle = useAnimatedStyle(() => ({
    opacity: opacity.value,
  }));

  return <Animated.Text style={[animStyle, bold && { fontWeight: '600' }]}>{text}</Animated.Text>;
}

interface Props {
  isActive: boolean;
  onNext: () => void;
  theme: { text: string; bg: string };
}

export default function NostalgiaScreen({ isActive, onNext, theme }: Props) {
  const insets = useSafeAreaInsets();
  const [phase, setPhase] = useState<'title' | 'image' | 'body'>('title');
  const [visiblePhrases, setVisiblePhrases] = useState(0);

  const titleOpacity = useSharedValue(0);
  const contentOpacity = useSharedValue(0);
  const buttonOpacity = useSharedValue(0);

  useEffect(() => {
    if (!isActive) return;
    titleOpacity.value = withDelay(200, withTiming(1, { duration: 800 }));

    const t1 = setTimeout(() => {
      titleOpacity.value = withTiming(0, { duration: 600 });
    }, 2200);
    const t2 = setTimeout(() => {
      setPhase('image');
      contentOpacity.value = withTiming(1, { duration: 800 });
    }, 3000);
    const t3 = setTimeout(() => {
      setPhase('body');
    }, 4000);
    return () => { clearTimeout(t1); clearTimeout(t2); clearTimeout(t3); };
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

  const titleStyle = useAnimatedStyle(() => ({
    opacity: titleOpacity.value,
  }));

  const contentStyle = useAnimatedStyle(() => ({
    opacity: contentOpacity.value,
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

      {/* Image + text */}
      <Animated.View style={[styles.content, { paddingTop: insets.top + 20 }, contentStyle]}>
        <View style={styles.imageArea}>
          <Image source={grassImage} style={styles.image} />
        </View>

        <View style={styles.textArea}>
          {phase === 'body' && (
            <Text style={[styles.body, { color: theme.text }]}>
              {PHRASES.map((phrase, i) => (
                <Phrase
                  key={i}
                  text={phrase + (i < PHRASES.length - 1 ? ' ' : '')}
                  visible={i < visiblePhrases}
                  bold={i === PHRASES.length - 1}
                />
              ))}
            </Text>
          )}
        </View>

        <Animated.View
          style={[styles.buttonArea, { paddingBottom: insets.bottom + 24 }, buttonAnimStyle]}
        >
          <PillButton label="Continue" onPress={onNext} color={theme.text} blur />
        </Animated.View>
      </Animated.View>
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
    fontWeight: '400',
    textAlign: 'center',
    lineHeight: 58,
  },
  content: {
    flex: 1,
    paddingHorizontal: 32,
  },
  imageArea: {
    flex: 1,
    justifyContent: 'flex-end',
    alignItems: 'center',
  },
  image: {
    width: 300,
    height: 300,
    resizeMode: 'contain',
  },
  textArea: {
    flex: 1,
    justifyContent: 'flex-start',
    alignItems: 'center',
    paddingTop: 24,
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
