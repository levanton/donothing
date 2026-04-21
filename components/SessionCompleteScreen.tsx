import { memo, useCallback, useEffect, useRef, useState } from 'react';
import { Dimensions, Image, Pressable, StyleSheet, Text, View } from 'react-native';
import { StatusBar } from 'expo-status-bar';
import * as Haptics from 'expo-haptics';
import { Gesture, GestureDetector } from 'react-native-gesture-handler';
import Animated, {
  Easing,
  interpolateColor,
  runOnJS,
  useAnimatedStyle,
  useSharedValue,
  withDelay,
  withRepeat,
  withSequence,
  withTiming,
} from 'react-native-reanimated';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import Svg, { Path } from 'react-native-svg';

import { Fonts } from '@/constants/theme';
import { themes, type ThemeMode } from '@/lib/theme';
import { updateSessionMood } from '@/lib/db/sessions';

const EASE_OUT = Easing.bezier(0.25, 0.1, 0.25, 1);

const CONTENT_FADE_MS = 500;

const MOODS = ['restless', 'calm', 'lighter', 'refreshed', 'grateful'] as const;
// Colors per mood — maps roughly to their emotional tone. Drives the circle
// colour morph and the page's subtle background wash.
const MOOD_COLORS = [
  '#C75B3A', // restless — warm red
  '#4E6D80', // calm — deep slate blue
  '#E0A653', // lighter — amber
  '#5D8F5B', // refreshed — forest green
  '#DF5C44', // grateful — terracotta (app accent)
] as const;

// Adaptive circle travelling inside a vessel-shaped track. The vessel widens
// gently from MIN on the left to MAX on the right, with semicircular caps
// closing each end — the circle fits flush at any progress.
const CIRCLE_MIN_SIZE = 56;
const CIRCLE_MAX_SIZE = 120;
const CONE_WIDTH = 180;
const CONE_PAD_LEFT = CIRCLE_MIN_SIZE / 2;
const CONE_PAD_RIGHT = CIRCLE_MAX_SIZE / 2;
const CONE_BOX_WIDTH = CONE_PAD_LEFT + CONE_WIDTH + CONE_PAD_RIGHT;
const CONE_BOX_HEIGHT = CIRCLE_MAX_SIZE + 20;
const CONE_MID_Y = CONE_BOX_HEIGHT / 2;
const CONE_LEFT = CONE_PAD_LEFT;
const CONE_RIGHT = CONE_PAD_LEFT + CONE_WIDTH;
// Closed vessel: top diagonal → right semicircle cap → bottom diagonal →
// left semicircle cap. Rendered as stroke only so it reads as a container.
const CONE_PATH = [
  `M ${CONE_LEFT} ${CONE_MID_Y - CIRCLE_MIN_SIZE / 2}`,
  `L ${CONE_RIGHT} ${CONE_MID_Y - CIRCLE_MAX_SIZE / 2}`,
  `A ${CIRCLE_MAX_SIZE / 2} ${CIRCLE_MAX_SIZE / 2} 0 0 1 ${CONE_RIGHT} ${CONE_MID_Y + CIRCLE_MAX_SIZE / 2}`,
  `L ${CONE_LEFT} ${CONE_MID_Y + CIRCLE_MIN_SIZE / 2}`,
  `A ${CIRCLE_MIN_SIZE / 2} ${CIRCLE_MIN_SIZE / 2} 0 0 1 ${CONE_LEFT} ${CONE_MID_Y - CIRCLE_MIN_SIZE / 2}`,
  'Z',
].join(' ');

// Mood colours at low alpha — tint the "carry on" button with the current hue.
const MOOD_SOFT = [
  'rgba(199, 91, 58, 0.32)',
  'rgba(78, 109, 128, 0.32)',
  'rgba(224, 166, 83, 0.32)',
  'rgba(93, 143, 91, 0.32)',
  'rgba(223, 92, 68, 0.32)',
] as const;

const MOOD_STOPS = MOODS.map((_, i) => i / (MOODS.length - 1));

const grassImage = require('@/assets/images/grass.png');
const SCREEN_H = Dimensions.get('window').height;
const GRASS_SIZE = Math.min(Math.round(SCREEN_H * 0.28), 260);

interface Props {
  visible: boolean;
  sessionId: string;
  durationSeconds: number;
  todaySeconds: number;
  themeMode: ThemeMode;
  onClose: () => void;
}

type Locale = 'en' | 'uk';

function pluralizeMinutes(n: number, locale: Locale): string {
  if (locale === 'uk') {
    const mod10 = n % 10;
    const mod100 = n % 100;
    if (mod100 >= 11 && mod100 <= 14) return 'хвилин';
    if (mod10 === 1) return 'хвилина';
    if (mod10 >= 2 && mod10 <= 4) return 'хвилини';
    return 'хвилин';
  }
  return n === 1 ? 'minute' : 'minutes';
}

function formatMinutes(seconds: number, locale: Locale = 'en'): { value: string; unit: string } {
  const m = Math.max(1, Math.round(seconds / 60));
  return { value: String(m), unit: pluralizeMinutes(m, locale) };
}

function SessionCompleteScreen({
  visible,
  sessionId,
  durationSeconds,
  todaySeconds,
  themeMode,
  onClose,
}: Props) {
  const insets = useSafeAreaInsets();
  const isDark = themeMode === 'dark';
  const theme = themes[themeMode];

  const contentOpacity = useSharedValue(0);

  const glowOpacity = useSharedValue(0);
  const glowScale = useSharedValue(0.94);
  const titleOpacity = useSharedValue(0);
  const titleY = useSharedValue(14);
  const titleScale = useSharedValue(0.96);
  const subtitleOpacity = useSharedValue(0);
  const subtitleY = useSharedValue(12);
  const circleBlockOpacity = useSharedValue(0);
  const circleBlockY = useSharedValue(12);
  const closeOpacity = useSharedValue(0);
  const closeY = useSharedValue(14);

  // Continuous 0..1 value — 0 maps to the smallest/coolest circle, 1 to the
  // biggest/warmest. Label + stored mood are bucketed to the 5 steps on end.
  const progress = useSharedValue(0.5);
  const pulse = useSharedValue(1);
  const dragStart = useSharedValue(0.5);

  const [activeMood, setActiveMood] = useState<string | null>(null);
  const statusStyle: 'light' | 'dark' = isDark ? 'light' : 'dark';

  const lastHapticStep = useSharedValue(-1);
  const dismissingRef = useRef(false);

  useEffect(() => {
    if (visible) {
      dismissingRef.current = false;
      setActiveMood(null);
      lastHapticStep.value = -1;
      progress.value = 0.5;

      contentOpacity.value = withTiming(1, { duration: CONTENT_FADE_MS, easing: EASE_OUT });

      const base = 220;
      glowOpacity.value = withDelay(base - 80, withTiming(1, { duration: 1400, easing: EASE_OUT }));
      glowScale.value = withDelay(base - 80, withTiming(1, { duration: 1400, easing: EASE_OUT }));

      titleOpacity.value = withDelay(base, withTiming(1, { duration: 1100, easing: EASE_OUT }));
      titleY.value = withDelay(base, withTiming(0, { duration: 1100, easing: EASE_OUT }));
      titleScale.value = withDelay(base, withTiming(1, { duration: 1200, easing: EASE_OUT }));

      subtitleOpacity.value = withDelay(base + 500, withTiming(1, { duration: 850, easing: EASE_OUT }));
      subtitleY.value = withDelay(base + 500, withTiming(0, { duration: 850, easing: EASE_OUT }));

      circleBlockOpacity.value = withDelay(base + 900, withTiming(1, { duration: 750, easing: EASE_OUT }));
      circleBlockY.value = withDelay(base + 900, withTiming(0, { duration: 750, easing: EASE_OUT }));

      closeOpacity.value = withDelay(base + 1300, withTiming(1, { duration: 650, easing: EASE_OUT }));
      closeY.value = withDelay(base + 1300, withTiming(0, { duration: 650, easing: EASE_OUT }));

      pulse.value = withDelay(
        base + 1000,
        withRepeat(
          withSequence(
            withTiming(1.05, { duration: 1600, easing: Easing.inOut(Easing.ease) }),
            withTiming(1.0, { duration: 1600, easing: Easing.inOut(Easing.ease) }),
          ),
          -1,
          false,
        ),
      );
    } else {
      contentOpacity.value = 0;
      glowOpacity.value = 0;
      glowScale.value = 0.94;
      titleOpacity.value = 0;
      titleY.value = 14;
      titleScale.value = 0.96;
      subtitleOpacity.value = 0;
      subtitleY.value = 12;
      circleBlockOpacity.value = 0;
      circleBlockY.value = 12;
      closeOpacity.value = 0;
      closeY.value = 14;
      pulse.value = 1;
    }
  }, [visible]);

  const setPreviewMood = useCallback((mood: string) => {
    setActiveMood(mood);
  }, []);

  const commitMood = useCallback(
    (mood: string) => {
      if (sessionId) updateSessionMood(sessionId, mood);
    },
    [sessionId],
  );

  const handleClose = useCallback(() => {
    if (dismissingRef.current) return;
    dismissingRef.current = true;
    Haptics.selectionAsync();
    contentOpacity.value = withTiming(0, { duration: 500, easing: EASE_OUT });
    setTimeout(onClose, 520);
  }, [onClose]);

  // Horizontal drag on the circle itself — drag right to grow it, left to
  // shrink. Circle centre tracks finger 1:1 (progress maps to CONE_TRAVEL).
  const circleGesture = Gesture.Pan()
    .onStart(() => {
      'worklet';
      dragStart.value = progress.value;
    })
    .onUpdate((e) => {
      'worklet';
      const next = Math.max(0, Math.min(1, dragStart.value + e.translationX / CONE_WIDTH));
      progress.value = next;
      const step = Math.min(MOODS.length - 1, Math.floor(next * MOODS.length));
      if (step !== lastHapticStep.value) {
        lastHapticStep.value = step;
        runOnJS(Haptics.selectionAsync)();
        runOnJS(setPreviewMood)(MOODS[step]);
      }
    })
    .onEnd(() => {
      'worklet';
      const step = Math.min(MOODS.length - 1, Math.floor(progress.value * MOODS.length));
      runOnJS(commitMood)(MOODS[step]);
    });

  const contentStyle = useAnimatedStyle(() => ({
    opacity: contentOpacity.value,
    pointerEvents: contentOpacity.value > 0.5 ? 'auto' : 'none',
    backgroundColor: theme.bg,
  }));
  const titleStyle = useAnimatedStyle(() => ({
    opacity: titleOpacity.value,
    transform: [{ translateY: titleY.value }, { scale: titleScale.value }],
  }));
  const subtitleStyle = useAnimatedStyle(() => ({
    opacity: subtitleOpacity.value,
    transform: [{ translateY: subtitleY.value }],
  }));
  const circleBlockStyle = useAnimatedStyle(() => ({
    opacity: circleBlockOpacity.value,
    transform: [{ translateY: circleBlockY.value }],
  }));
  const closeStyleAnim = useAnimatedStyle(() => ({
    opacity: closeOpacity.value,
    transform: [{ translateY: closeY.value }],
  }));

  // Mood-tinted button bg — carries the current hue without shouting.
  const doneBgStyle = useAnimatedStyle(() => ({
    backgroundColor: interpolateColor(progress.value, MOOD_STOPS, MOOD_SOFT as unknown as string[]),
  }));

  const glowWrapStyle = useAnimatedStyle(() => ({
    opacity: glowOpacity.value,
    transform: [{ scale: glowScale.value }],
  }));

  // The circle — its diameter matches the cone's vertical opening at its
  // centre x, so it fills the cone flush at every progress value. Breath
  // pulse rides on scale so it doesn't fight the size animation.
  const circleStyle = useAnimatedStyle(() => {
    const p = progress.value;
    const size = CIRCLE_MIN_SIZE + p * (CIRCLE_MAX_SIZE - CIRCLE_MIN_SIZE);
    const centerX = CONE_LEFT + p * CONE_WIDTH;
    return {
      width: size,
      height: size,
      borderRadius: size / 2,
      left: centerX - size / 2,
      top: CONE_MID_Y - size / 2,
      backgroundColor: interpolateColor(progress.value, MOOD_STOPS, MOOD_COLORS as unknown as string[]),
      transform: [{ scale: pulse.value }],
    };
  });

  if (!visible) return null;

  const textColor = theme.text;
  const softText = theme.textSecondary;
  const tertiaryText = theme.textTertiary;

  const duration = formatMinutes(durationSeconds);
  const today = formatMinutes(todaySeconds);

  return (
    <View style={styles.root}>
      <StatusBar style={statusStyle} />

      {/* Cream background + content layer */}
      <Animated.View style={[StyleSheet.absoluteFillObject, contentStyle]}>
        <View
          style={[
            styles.layout,
            { paddingTop: insets.top + 32, paddingBottom: insets.bottom + 40 },
          ]}
        >
          <View style={styles.centerGroup}>
            <View style={styles.summary}>
              <Animated.View style={[styles.grassWrap, glowWrapStyle]} pointerEvents="none">
                <Image source={grassImage} style={styles.grassImage} fadeDuration={0} />
              </Animated.View>

              <Animated.View style={[styles.titleBlock, titleStyle]}>
                <Text style={[styles.titleMain, { color: textColor, fontFamily: Fonts.serif }]}>
                  {duration.value} {duration.unit}
                </Text>
                <Text style={[styles.titleSub, { color: textColor, fontFamily: Fonts.serif }]}>
                  with yourself
                </Text>
              </Animated.View>

              {todaySeconds > durationSeconds && (
                <Animated.Text
                  style={[
                    styles.subtitle,
                    { color: softText, fontFamily: Fonts.serif },
                    subtitleStyle,
                  ]}
                >
                  {`today, that's ${today.value} ${today.unit}`}
                </Animated.Text>
              )}
            </View>

            <Animated.View style={[styles.interaction, circleBlockStyle]}>
              <Text
                style={[
                  styles.prompt,
                  {
                    color: activeMood ? softText : tertiaryText,
                    fontFamily: Fonts.serif,
                  },
                ]}
              >
                {activeMood ? `i feel ${activeMood}` : 'how do you feel?'}
              </Text>

              <GestureDetector gesture={circleGesture}>
                <View style={styles.coneTrack}>
                  {/* Vessel — diagonal walls capped by semicircles at each end */}
                  <Svg
                    width={CONE_BOX_WIDTH}
                    height={CONE_BOX_HEIGHT}
                    style={StyleSheet.absoluteFill}
                    pointerEvents="none"
                  >
                    <Path
                      d={CONE_PATH}
                      stroke={tertiaryText}
                      strokeWidth={1.75}
                      strokeLinecap="round"
                      strokeLinejoin="round"
                      fill="none"
                    />
                  </Svg>
                  <Animated.View pointerEvents="none" style={[styles.circle, circleStyle]} />
                </View>
              </GestureDetector>
            </Animated.View>
          </View>

          <Animated.View style={closeStyleAnim}>
            <Pressable onPress={handleClose}>
              <Animated.View style={[styles.doneBtn, doneBgStyle]}>
                <Text style={[styles.doneLabel, { color: textColor, fontFamily: Fonts.serif }]}>
                  carry on
                </Text>
              </Animated.View>
            </Pressable>
          </Animated.View>
        </View>
      </Animated.View>
    </View>
  );
}

export default memo(SessionCompleteScreen);

const styles = StyleSheet.create({
  root: {
    ...StyleSheet.absoluteFillObject,
    zIndex: 120,
  },
  layout: {
    flex: 1,
    paddingHorizontal: 32,
    alignItems: 'center',
  },
  centerGroup: {
    flex: 1,
    width: '100%',
    alignItems: 'center',
    justifyContent: 'center',
  },
  summary: {
    alignItems: 'center',
  },
  grassWrap: {
    alignItems: 'center',
    justifyContent: 'center',
    marginBottom: 8,
  },
  grassImage: {
    width: GRASS_SIZE,
    height: GRASS_SIZE,
    resizeMode: 'contain',
  },
  titleBlock: {
    alignItems: 'center',
  },
  titleMain: {
    fontSize: 44,
    fontWeight: '500',
    letterSpacing: 0.2,
    textAlign: 'center',
  },
  titleSub: {
    fontSize: 20,
    fontWeight: '300',
    fontStyle: 'italic',
    letterSpacing: 0.4,
    textAlign: 'center',
    marginTop: 6,
  },
  subtitle: {
    fontSize: 16,
    fontWeight: '300',
    letterSpacing: 0.3,
    textAlign: 'center',
    marginTop: 22,
  },
  interaction: {
    alignItems: 'center',
    marginTop: 48,
  },
  prompt: {
    fontSize: 15,
    fontWeight: '300',
    fontStyle: 'italic',
    letterSpacing: 0.4,
    textAlign: 'center',
    marginBottom: 26,
  },
  coneTrack: {
    width: CONE_BOX_WIDTH,
    height: CONE_BOX_HEIGHT,
    position: 'relative',
  },
  circle: {
    position: 'absolute',
  },
  doneBtn: {
    borderRadius: 100,
    paddingVertical: 18,
    paddingHorizontal: 60,
    alignItems: 'center',
    justifyContent: 'center',
    shadowColor: '#000',
    shadowOpacity: 0.08,
    shadowRadius: 14,
    shadowOffset: { width: 0, height: 4 },
  },
  doneLabel: {
    fontSize: 18,
    fontWeight: '400',
    fontStyle: 'italic',
    letterSpacing: 0.6,
  },
});
