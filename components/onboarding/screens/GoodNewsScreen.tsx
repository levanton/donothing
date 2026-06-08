import { useEffect } from 'react';
import { Image, Pressable, StyleSheet, Text, View } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import Animated, {
  useAnimatedStyle,
  useSharedValue,
  withDelay,
  withTiming,
} from 'react-native-reanimated';
import { Feather } from '@expo/vector-icons';

import { EASE_OUT } from '@/constants/animations';
import { Fonts } from '@/constants/theme';
import { palette } from '@/lib/theme';

const sitImage = require('@/assets/images/good-news.png');

const HEADING = 'good news.';
const SUBTITLE = 'you don’t have to do anything.';

const NOTHINGS = [
  'no pushups.',
  'no reading a book.',
  'no learning a language.',
  'no journaling.',
  'no meditating.',
  'no fixing yourself.',
];

interface Props {
  isActive: boolean;
  onNext: () => void;
  theme: { text: string; bg: string };
}

export default function GoodNewsScreen({ isActive, onNext, theme }: Props) {
  const insets = useSafeAreaInsets();

  const opacity = useSharedValue(0);
  const translateY = useSharedValue(12);
  const buttonOpacity = useSharedValue(0);

  useEffect(() => {
    if (!isActive) return;
    opacity.value = withTiming(1, { duration: 700, easing: EASE_OUT });
    translateY.value = withTiming(0, { duration: 700, easing: EASE_OUT });
    buttonOpacity.value = withDelay(
      900,
      withTiming(1, { duration: 600, easing: EASE_OUT }),
    );
  }, [isActive]);

  const contentStyle = useAnimatedStyle(() => ({
    opacity: opacity.value,
    transform: [{ translateY: translateY.value }],
  }));

  const buttonStyle = useAnimatedStyle(() => ({
    opacity: buttonOpacity.value,
  }));

  return (
    <View style={[styles.container, { backgroundColor: theme.bg }]}>
      <View
        style={[
          styles.content,
          { paddingTop: insets.top + 16, paddingBottom: insets.bottom },
        ]}
      >
        <View style={styles.imageArea}>
          <Image source={sitImage} style={styles.image} resizeMode="contain" />
        </View>

        <Animated.View style={[styles.textArea, contentStyle]}>
          <Text style={[styles.heading, { color: theme.text }]}>{HEADING}</Text>
          <View style={[styles.divider, { backgroundColor: palette.terracotta }]} />

          <Text style={[styles.subtitle, { color: theme.text }]}>{SUBTITLE}</Text>

          <View style={styles.list}>
            {NOTHINGS.map((item, i) => (
              <View key={i} style={styles.row}>
                <Feather name="x" size={16} color={palette.terracotta} />
                <Text style={[styles.rowText, { color: theme.text }]}>{item}</Text>
              </View>
            ))}
          </View>
        </Animated.View>

        <View style={styles.spacer} />

        <Animated.View style={[styles.buttonArea, buttonStyle]}>
          <Pressable onPress={onNext} style={styles.ctaButton}>
            <Text style={styles.ctaText}>try nothing</Text>
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
  content: {
    flex: 1,
    paddingHorizontal: 32,
  },
  imageArea: {
    alignItems: 'center',
    justifyContent: 'center',
    paddingTop: 12,
    paddingBottom: 20,
  },
  image: {
    width: 340,
    height: 260,
    alignSelf: 'center',
  },
  textArea: {},
  spacer: {
    flex: 1,
  },
  heading: {
    fontFamily: Fonts?.serif,
    fontSize: 40,
    fontWeight: '500',
    lineHeight: 46,
  },
  divider: {
    width: 44,
    height: 2,
    borderRadius: 1,
    marginTop: 14,
    marginBottom: 18,
  },
  subtitle: {
    fontFamily: Fonts?.serif,
    fontSize: 21,
    fontWeight: '400',
    lineHeight: 28,
    marginBottom: 18,
  },
  list: {
    gap: 10,
  },
  row: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 12,
  },
  rowText: {
    fontFamily: Fonts?.serif,
    fontSize: 19,
    fontWeight: '400',
    lineHeight: 26,
  },
  buttonArea: {
    alignItems: 'center',
    paddingBottom: 24,
    gap: 18,
  },
  ctaButton: {
    backgroundColor: palette.terracotta,
    borderRadius: 100,
    paddingVertical: 16,
    paddingHorizontal: 32,
  },
  ctaText: {
    fontFamily: Fonts?.serif,
    fontSize: 18,
    fontWeight: '400',
    color: palette.cream,
  },
});
