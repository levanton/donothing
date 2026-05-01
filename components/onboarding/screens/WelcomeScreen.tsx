import { useEffect } from 'react';
import { StyleSheet, Text, View } from 'react-native';
import Animated, {
  useSharedValue,
  useAnimatedStyle,
  withTiming,
  withDelay,
  withSequence,
} from 'react-native-reanimated';
import { EASE_OUT } from '@/constants/animations';
import { Fonts } from '@/constants/theme';

const FADE_IN_MS = 900;
const HOLD_MS = 1400;
const FADE_OUT_MS = 700;

interface Props {
  isActive: boolean;
  onNext: () => void;
  theme: { text: string; bg: string };
}

export default function WelcomeScreen({ isActive, onNext, theme }: Props) {
  const opacity = useSharedValue(0);
  const translateY = useSharedValue(8);

  useEffect(() => {
    if (!isActive) return;

    opacity.value = withSequence(
      withTiming(1, { duration: FADE_IN_MS, easing: EASE_OUT }),
      withDelay(HOLD_MS, withTiming(0, { duration: FADE_OUT_MS, easing: EASE_OUT })),
    );
    translateY.value = withTiming(0, { duration: FADE_IN_MS, easing: EASE_OUT });

    const total = FADE_IN_MS + HOLD_MS + FADE_OUT_MS;
    const t = setTimeout(() => onNext(), total);
    return () => clearTimeout(t);
  }, [isActive]);

  const textStyle = useAnimatedStyle(() => ({
    opacity: opacity.value,
    transform: [{ translateY: translateY.value }],
  }));

  return (
    <View style={[styles.container, { backgroundColor: theme.bg }]}>
      <Animated.View style={textStyle}>
        <Text style={[styles.greeting, { color: theme.text, fontFamily: Fonts?.serif }]}>
          Welcome to nothing
        </Text>
      </Animated.View>
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
    paddingHorizontal: 32,
  },
  greeting: {
    fontSize: 44,
    fontWeight: '500',
    letterSpacing: -0.5,
    lineHeight: 52,
    textAlign: 'center',
  },
});
