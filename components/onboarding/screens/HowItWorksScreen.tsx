import { useEffect } from 'react';
import { StyleSheet, Text, View } from 'react-native';
import Animated, {
  useSharedValue,
  useAnimatedStyle,
  withTiming,
  withDelay,
  withRepeat,
  withSequence,
} from 'react-native-reanimated';
import { Feather } from '@expo/vector-icons';
import { EASE_IN_OUT, EASE_OUT } from '@/constants/animations';
import { Fonts } from '@/constants/theme';
import { palette } from '@/lib/theme';

const HEADING_DELAY = 100;
const CARD1_DELAY = 600;
const CARD1_RISE_MS = 800;

const ICON_RISE_MS = 600;
const CARD1_ICON_DELAY = CARD1_DELAY + 400;

const CARD2_DELAY = CARD1_ICON_DELAY + ICON_RISE_MS + 200;
const CARD2_RISE_MS = 800;
const CARD2_ICON_DELAY = CARD2_DELAY + 400;

const FADE_DURATION = 700;

interface Props {
  isActive: boolean;
  onNext: () => void;
  theme: { text: string; bg: string };
}

export default function HowItWorksScreen({ isActive, theme }: Props) {
  const headingOpacity = useSharedValue(0);

  const card1Opacity = useSharedValue(0);
  const card1Translate = useSharedValue(-40);

  const lockOpacity = useSharedValue(0);
  const lockScale = useSharedValue(0.4);

  const card2Opacity = useSharedValue(0);
  const card2Translate = useSharedValue(40);

  const windOpacity = useSharedValue(0);
  const windScale = useSharedValue(0.4);

  const lockBreath = useSharedValue(0);
  const windSway = useSharedValue(0);

  useEffect(() => {
    if (!isActive) return;

    headingOpacity.value = withDelay(HEADING_DELAY, withTiming(1, { duration: FADE_DURATION, easing: EASE_OUT }));

    card1Opacity.value = withDelay(CARD1_DELAY, withTiming(1, { duration: FADE_DURATION, easing: EASE_OUT }));
    card1Translate.value = withDelay(CARD1_DELAY, withTiming(0, { duration: CARD1_RISE_MS, easing: EASE_OUT }));

    lockOpacity.value = withDelay(CARD1_ICON_DELAY, withTiming(1, { duration: ICON_RISE_MS, easing: EASE_OUT }));
    lockScale.value = withDelay(CARD1_ICON_DELAY, withTiming(1, { duration: ICON_RISE_MS, easing: EASE_OUT }));

    card2Opacity.value = withDelay(CARD2_DELAY, withTiming(1, { duration: FADE_DURATION, easing: EASE_OUT }));
    card2Translate.value = withDelay(CARD2_DELAY, withTiming(0, { duration: CARD2_RISE_MS, easing: EASE_OUT }));

    windOpacity.value = withDelay(CARD2_ICON_DELAY, withTiming(1, { duration: ICON_RISE_MS, easing: EASE_OUT }));
    windScale.value = withDelay(CARD2_ICON_DELAY, withTiming(1, { duration: ICON_RISE_MS, easing: EASE_OUT }));

    lockBreath.value = withDelay(
      CARD1_ICON_DELAY + ICON_RISE_MS,
      withRepeat(
        withTiming(1, { duration: 2400, easing: EASE_IN_OUT }),
        -1,
        true,
      ),
    );

    windSway.value = withDelay(
      CARD2_ICON_DELAY + ICON_RISE_MS,
      withSequence(
        withTiming(-1, { duration: 900, easing: EASE_IN_OUT }),
        withRepeat(
          withTiming(1, { duration: 1800, easing: EASE_IN_OUT }),
          -1,
          true,
        ),
      ),
    );
  }, [isActive]);

  const headingStyle = useAnimatedStyle(() => ({
    opacity: headingOpacity.value,
  }));

  const card1Style = useAnimatedStyle(() => ({
    opacity: card1Opacity.value,
    transform: [{ translateX: card1Translate.value }],
  }));

  const card2Style = useAnimatedStyle(() => ({
    opacity: card2Opacity.value,
    transform: [{ translateX: card2Translate.value }],
  }));

  const lockIconStyle = useAnimatedStyle(() => ({
    opacity: lockOpacity.value,
    transform: [{ scale: lockScale.value * (1 + lockBreath.value * 0.05) }],
  }));

  const windIconStyle = useAnimatedStyle(() => ({
    opacity: windOpacity.value,
    transform: [
      { scale: windScale.value },
      { translateX: windSway.value * 5 },
    ],
  }));

  return (
    <View style={[styles.container, { backgroundColor: theme.bg }]}>
      <View style={styles.content}>
        <Animated.Text style={[styles.heading, headingStyle, { color: theme.text, fontFamily: Fonts?.serif }]}>
          Nothing is simple
        </Animated.Text>

        <View style={styles.cards}>
          <Animated.View style={[styles.card, { backgroundColor: '#DDB97A' }, card1Style]}>
            <Animated.View style={[styles.cardIcon, lockIconStyle]}>
              <Feather name="lock" size={36} color={palette.brown} />
            </Animated.View>
            <Text style={[styles.cardLabel, { color: palette.brown, fontFamily: Fonts?.serif }]}>
              Your apps block
            </Text>
          </Animated.View>

          <Animated.View style={[styles.card, { backgroundColor: '#3D5547' }, card2Style]}>
            <Animated.View style={[styles.cardIcon, windIconStyle]}>
              <Feather name="wind" size={36} color={palette.cream} />
            </Animated.View>
            <Text style={[styles.cardLabel, { color: palette.cream, fontFamily: Fonts?.serif }]}>
              {'Do nothing to unblock'}
            </Text>
          </Animated.View>
        </View>
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    justifyContent: 'center',
    paddingHorizontal: 20,
  },
  content: {
    alignItems: 'center',
  },
  heading: {
    fontSize: 34,
    fontWeight: '400',
    marginBottom: 32,
    textAlign: 'left',
    alignSelf: 'flex-start',
  },
  cards: {
    flexDirection: 'row',
    alignItems: 'stretch',
    justifyContent: 'center',
    gap: 12,
  },
  card: {
    flex: 1,
    minHeight: 215,
    paddingTop: 22,
    paddingBottom: 22,
    paddingHorizontal: 20,
    borderRadius: 18,
    justifyContent: 'flex-end',
  },
  cardIcon: {
    position: 'absolute',
    top: 22,
    left: 20,
  },
  cardLabel: {
    fontSize: 22,
    fontWeight: '700',
    letterSpacing: -0.2,
    lineHeight: 28,
    textAlign: 'left',
  },
});
