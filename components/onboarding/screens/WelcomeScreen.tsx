import { Feather, MaterialCommunityIcons } from '@expo/vector-icons';
import { useEffect } from 'react';
import { Image, StyleSheet, Text, View } from 'react-native';
import Animated, {
  useAnimatedStyle,
  useSharedValue,
  withTiming,
} from 'react-native-reanimated';

import { EASE_OUT } from '@/constants/animations';
import { Fonts } from '@/constants/theme';
import { palette } from '@/lib/theme';

const FADE_IN_MS = 900;

const welcomeImage = require('@/assets/images/visuals/circle-welcome.png');

type Feature = { icon: string; label: string; mci?: boolean };

const FEATURES: Feature[] = [
  { icon: 'leaf', label: 'pause', mci: true },
  { icon: 'cloud', label: 'breathe' },
  { icon: 'disc', label: 'be here' },
];

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
        <Text style={[styles.welcome, { color: theme.text }]}>Welcome</Text>
        <Text style={[styles.welcome, { color: palette.terracotta }]}>
          to Nothing
        </Text>

        <View
          style={[styles.divider, { backgroundColor: palette.terracotta }]}
        />

        <Text style={[styles.essence, { color: theme.text }]}>
          a quiet space to step out of the rush — and do{' '}
          <Text style={styles.essenceStrong}>absolutely nothing</Text>.
        </Text>

        <View style={styles.features}>
          {FEATURES.map((f, i) => (
            <View
              key={f.label}
              style={[styles.feature, i > 0 && styles.featureWithSep]}
            >
              {f.mci ? (
                <MaterialCommunityIcons
                  name={f.icon as never}
                  size={22}
                  color={palette.terracotta}
                />
              ) : (
                <Feather
                  name={f.icon as never}
                  size={22}
                  color={palette.terracotta}
                />
              )}
              <Text style={[styles.featureLabel, { color: theme.text }]}>
                {f.label}
              </Text>
            </View>
          ))}
        </View>
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
    paddingBottom: 80,
  },
  textBlock: {
    marginBottom: 120,
  },
  image: {
    position: 'absolute',
    right: 0,
    bottom: -50,
    width: 240,
    aspectRatio: 577 / 800,
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
    maxWidth: 300,
  },
  essenceStrong: {
    fontWeight: '600',
  },
  features: {
    flexDirection: 'row',
    alignItems: 'flex-start',
    marginTop: 36,
  },
  feature: {
    alignItems: 'center',
    gap: 7,
    paddingRight: 18,
  },
  featureWithSep: {
    paddingLeft: 18,
    borderLeftWidth: 1,
    borderLeftColor: palette.terracotta + '33',
  },
  featureLabel: {
    fontFamily: Fonts?.serif,
    fontSize: 13,
    fontWeight: '400',
    letterSpacing: 0.3,
  },
});
