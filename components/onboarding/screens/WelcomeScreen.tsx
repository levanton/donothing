import { useEffect } from 'react';
import { StyleSheet, Text, View } from 'react-native';
import Animated, {
  useSharedValue,
  useAnimatedStyle,
  withTiming,
} from 'react-native-reanimated';
import { EASE_OUT } from '@/constants/animations';
import { Fonts } from '@/constants/theme';

const FADE_IN_MS = 900;

interface Props {
  isActive: boolean;
  onNext: () => void;
  theme: { text: string; bg: string };
}

export default function WelcomeScreen({ isActive, theme }: Props) {
  const opacity = useSharedValue(0);
  const translateY = useSharedValue(8);

  useEffect(() => {
    if (!isActive) return;

    // Fade in and stay — advancing is manual (circle-next arrow in the
    // onboarding shell), so this is a real first page, not a splash.
    opacity.value = withTiming(1, { duration: FADE_IN_MS, easing: EASE_OUT });
    translateY.value = withTiming(0, { duration: FADE_IN_MS, easing: EASE_OUT });
  }, [isActive]);

  const textStyle = useAnimatedStyle(() => ({
    opacity: opacity.value,
    transform: [{ translateY: translateY.value }],
  }));

  return (
    <View style={[styles.container, { backgroundColor: theme.bg }]}>
      <Animated.View style={textStyle}>
        <Text style={[styles.greeting, { color: theme.text, fontFamily: Fonts?.serif }]}>
          {'welcome\nto nothing'}
        </Text>
      </Animated.View>
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'flex-start',
    paddingHorizontal: 32,
  },
  greeting: {
    fontSize: 38,
    fontWeight: '500',
    letterSpacing: -0.5,
    lineHeight: 46,
    textAlign: 'left',
  },
});
