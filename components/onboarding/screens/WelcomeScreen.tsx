import { useEffect } from 'react';
import { Image, StyleSheet, Text, View } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import Animated, {
  useAnimatedStyle,
  useSharedValue,
  withDelay,
  withTiming,
} from 'react-native-reanimated';

import { EASE_OUT } from '@/constants/animations';
import { Fonts } from '@/constants/theme';
import { palette } from '@/lib/theme';
import CtaButton from '../CtaButton';

const FADE_IN_MS = 900;
const BUTTON_AT_MS = 700;

const welcomeImage = require('@/assets/images/visuals/circle-welcome.png');

interface Props {
  isActive: boolean;
  onNext: () => void;
  theme: { text: string; bg: string };
}

export default function WelcomeScreen({ isActive, onNext, theme }: Props) {
  const insets = useSafeAreaInsets();
  const opacity = useSharedValue(0);
  const translateY = useSharedValue(8);
  const button = useSharedValue(0);

  useEffect(() => {
    if (!isActive) return;

    // Fade in and stay — advancing is manual (the begin button), so this
    // is a real first page, not a splash.
    opacity.value = withTiming(1, { duration: FADE_IN_MS, easing: EASE_OUT });
    translateY.value = withTiming(0, {
      duration: FADE_IN_MS,
      easing: EASE_OUT,
    });
    button.value = withDelay(
      BUTTON_AT_MS,
      withTiming(1, { duration: 500, easing: EASE_OUT }),
    );
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [isActive]);

  const textStyle = useAnimatedStyle(() => ({
    opacity: opacity.value,
    transform: [{ translateY: translateY.value }],
  }));

  const buttonStyle = useAnimatedStyle(() => ({
    opacity: button.value,
  }));

  return (
    <View style={[styles.container, { backgroundColor: theme.bg }]}>
      <Animated.View style={[styles.textBlock, textStyle]}>
        <Text style={[styles.welcome, { color: theme.text }]}>welcome</Text>
        <Text style={[styles.welcome, { color: theme.text }]}>
          to <Text style={{ color: palette.terracotta }}>nothing</Text>
        </Text>

        <View
          style={[styles.divider, { backgroundColor: palette.terracotta }]}
        />

        <Text style={[styles.essence, { color: theme.text }]}>
          a space to step out of the rush — and do{' '}
          <Text style={styles.essenceStrong}>nothing</Text>.
        </Text>

      </Animated.View>

      <Image
        source={welcomeImage}
        style={styles.image}
        resizeMode='contain'
        fadeDuration={0}
      />

      <Animated.View
        style={[styles.buttonArea, { paddingBottom: insets.bottom + 24 }, buttonStyle]}
      >
        <CtaButton label="begin" onPress={onNext} />
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
    paddingBottom: 80,
  },
  textBlock: {
    marginBottom: 120,
    // Text always paints above the decorative circle — on narrow screens
    // (SE) the absolute image overlaps the copy's right edge, and without
    // this the later-rendered image would cover the words.
    zIndex: 1,
  },
  image: {
    position: 'absolute',
    right: 0,
    bottom: -50,
    width: 240,
    aspectRatio: 577 / 800,
    // Behind the text — purely decorative.
    zIndex: 0,
  },
  buttonArea: {
    position: 'absolute',
    bottom: 0,
    left: 0,
    right: 0,
    alignItems: 'center',
  },
  welcome: {
    fontFamily: Fonts?.serif,
    fontSize: 42,
    fontWeight: '500',
    letterSpacing: 0.4,
    lineHeight: 46,
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
    maxWidth: 270,
  },
  essenceStrong: {
    fontWeight: '600',
  },
});
