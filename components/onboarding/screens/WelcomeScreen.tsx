import { EASE_OUT } from '@/constants/animations';
import { Fonts } from '@/constants/theme';
import { palette } from '@/lib/theme';
import { useEffect } from 'react';
import { Image, StyleSheet, Text, View } from 'react-native';
import Animated, {
  useAnimatedStyle,
  useSharedValue,
  withTiming,
} from 'react-native-reanimated';

const FADE_IN_MS = 900;

const welcomeImage = require('@/assets/images/visuals/circle-welcome.png');

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
    translateY.value = withTiming(0, {
      duration: FADE_IN_MS,
      easing: EASE_OUT,
    });
  }, [isActive]);

  const textStyle = useAnimatedStyle(() => ({
    opacity: opacity.value,
    transform: [{ translateY: translateY.value }],
  }));

  return (
    <View style={[styles.container, { backgroundColor: theme.bg }]}>
      <Animated.View style={[styles.textBlock, textStyle]}>
        <Text style={[styles.welcome, { color: theme.text }]}>welcome</Text>
        <Text style={[styles.welcome, { color: palette.terracotta }]}>
          to nothing
        </Text>

        <View
          style={[styles.divider, { backgroundColor: palette.terracotta }]}
        />

        <Text style={[styles.essence, { color: theme.text }]}>
          a quiet space to step out of the rush — and do absolutely nothing.
        </Text>
      </Animated.View>

      <Image
        source={welcomeImage}
        style={styles.image}
        resizeMode='contain'
        fadeDuration={0}
      />
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'flex-start',
    paddingHorizontal: 32,
    paddingBottom: 100,
  },
  textBlock: {
    marginBottom: 140,
  },
  image: {
    position: 'absolute',
    right: 0,
    top: '25%',
    width: 250,
    aspectRatio: 577 / 800,
  },
  welcome: {
    fontFamily: Fonts?.serif,
    fontSize: 48,
    fontWeight: '400',
    letterSpacing: 0.4,
    lineHeight: 50,
    textAlign: 'left',
  },
  divider: {
    width: 44,
    height: 2,
    borderRadius: 1,
    marginTop: 28,
    marginBottom: 22,
  },
  essence: {
    fontFamily: Fonts?.serif,
    fontSize: 18,
    fontWeight: '400',
    letterSpacing: 0.2,
    lineHeight: 27,
    maxWidth: 300,
  },
});
