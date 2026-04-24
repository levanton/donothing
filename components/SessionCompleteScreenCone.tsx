import { memo, useCallback, useEffect, useRef, useState } from 'react';
import { Dimensions, Image, Pressable, StyleSheet, Text, View } from 'react-native';
import { StatusBar } from 'expo-status-bar';
import * as Haptics from 'expo-haptics';
import { Gesture, GestureDetector } from 'react-native-gesture-handler';
import Animated, {
  Easing,
  interpolateColor,
  runOnJS,
  useAnimatedProps,
  useAnimatedStyle,
  useSharedValue,
  withDelay,
  withTiming,
} from 'react-native-reanimated';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import Svg, { Ellipse, Line, Path } from 'react-native-svg';

const AnimatedEllipse = Animated.createAnimatedComponent(Ellipse);
const AnimatedPath = Animated.createAnimatedComponent(Path);

import { Fonts } from '@/constants/theme';
import { palette, themes, type ThemeMode } from '@/lib/theme';
import { updateSessionMood } from '@/lib/db/sessions';

const EASE_OUT = Easing.bezier(0.25, 0.1, 0.25, 1);

const CONTENT_FADE_MS = 500;

const MOODS = ['restless', 'calm', 'lighter', 'refreshed', 'grateful'] as const;

// Adaptive ball travelling inside a cone that comes to a sharp point on the
// left and opens into a perspective ellipse on the right. Ball size tracks
// the cone opening at its current x, so it grows from 0 at the tip to the
// full CIRCLE_MAX_SIZE at the wide end.
const CIRCLE_MAX_SIZE = 120;
const CONE_WIDTH = 200;
const CONE_PAD_RIGHT = CIRCLE_MAX_SIZE / 2;
const CONE_BOX_WIDTH = CONE_WIDTH + CONE_PAD_RIGHT + 8;
const CONE_BOX_HEIGHT = CIRCLE_MAX_SIZE + 20;
const CONE_MID_Y = CONE_BOX_HEIGHT / 2;
const CONE_LEFT = 4;
const CONE_RIGHT = CONE_LEFT + CONE_WIDTH;
// Perspective compression for the right end opening — a narrow ellipse
// reads as a circle tilted away from the camera.
const PERSPECTIVE_RATIO = 0.32;
const RIGHT_RX = (CIRCLE_MAX_SIZE / 2) * PERSPECTIVE_RATIO;
const RIGHT_RY = CIRCLE_MAX_SIZE / 2;
// Ball travels from the sharp tip (cx=CONE_LEFT, size 0) to the wide cap
// (cx=CONE_RIGHT, size CIRCLE_MAX_SIZE).
const BALL_X_START = CONE_LEFT;
const BALL_X_END = CONE_RIGHT;
const BALL_TRAVEL = BALL_X_END - BALL_X_START;

// Mood colours at low alpha — tint the "carry on" button with the current hue.
const MOOD_SOFT = [
  'rgba(199, 91, 58, 0.32)',
  'rgba(78, 109, 128, 0.32)',
  'rgba(224, 166, 83, 0.32)',
  'rgba(93, 143, 91, 0.32)',
  'rgba(194, 103, 73, 0.32)',
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

function SessionCompleteScreenCone({
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

  // Continuous 0..1 value — 0 starts with the smallest position (restless),
  // 1 ends at the biggest (grateful). Stored mood is still bucketed to the
  // 5 steps on commit.
  const progress = useSharedValue(0);
  const dragStart = useSharedValue(0);

  const [activeMood, setActiveMood] = useState<string | null>(null);
  const statusStyle: 'light' | 'dark' = isDark ? 'light' : 'dark';

  const lastHapticStep = useSharedValue(-1);
  const dismissingRef = useRef(false);

  useEffect(() => {
    if (visible) {
      dismissingRef.current = false;
      setActiveMood(null);
      lastHapticStep.value = -1;
      progress.value = 0;

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
      const next = Math.max(0, Math.min(1, dragStart.value + e.translationX / BALL_TRAVEL));
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

  // Moving ball — narrow ellipse with the same PERSPECTIVE_RATIO as the
  // right cap so it sits in the same tilted space as the rest of the scene.
  const moodEllipseProps = useAnimatedProps(() => {
    const p = progress.value;
    const cx = BALL_X_START + p * BALL_TRAVEL;
    const size = ((cx - CONE_LEFT) / CONE_WIDTH) * CIRCLE_MAX_SIZE;
    const ry = size / 2;
    return {
      cx,
      cy: CONE_MID_Y,
      rx: ry * PERSPECTIVE_RATIO,
      ry,
    };
  });

  // Progress fill — triangle from the sharp left tip out to the ball's
  // current centre, closed by a straight vertical at the ball.
  const fillPathProps = useAnimatedProps(() => {
    const p = progress.value;
    const cx = BALL_X_START + p * BALL_TRAVEL;
    const size = ((cx - CONE_LEFT) / CONE_WIDTH) * CIRCLE_MAX_SIZE;
    const ry = size / 2;
    const topCurY = CONE_MID_Y - ry;
    const botCurY = CONE_MID_Y + ry;
    const d = `M ${CONE_LEFT} ${CONE_MID_Y} L ${cx} ${topCurY} L ${cx} ${botCurY} Z`;
    return { d };
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
                  { color: textColor, fontFamily: Fonts.serif },
                ]}
              >
                how full do you feel?
              </Text>

              <GestureDetector gesture={circleGesture}>
                <View style={styles.coneTrack}>
                  <Svg
                    width={CONE_BOX_WIDTH}
                    height={CONE_BOX_HEIGHT}
                    style={StyleSheet.absoluteFill}
                    pointerEvents="none"
                  >
                    {/* Progress fill — terracotta trapezoid from the left cap
                        up to the ball's centre. Drawn first so the outlines
                        and the ball sit on top. */}
                    <AnimatedPath
                      animatedProps={fillPathProps}
                      fill={palette.terracotta}
                    />

                    {/* Cone walls — converge to a sharp point on the left,
                        open into the right cap on the right */}
                    <Line
                      x1={CONE_LEFT}
                      y1={CONE_MID_Y}
                      x2={CONE_RIGHT}
                      y2={CONE_MID_Y - CIRCLE_MAX_SIZE / 2}
                      stroke={textColor}
                      strokeWidth={1.75}
                      strokeLinecap="round"
                    />
                    <Line
                      x1={CONE_LEFT}
                      y1={CONE_MID_Y}
                      x2={CONE_RIGHT}
                      y2={CONE_MID_Y + CIRCLE_MAX_SIZE / 2}
                      stroke={textColor}
                      strokeWidth={1.75}
                      strokeLinecap="round"
                    />

                    {/* The moving ball — drawn before the right cap so the
                        cap outline sits on top of it when they overlap */}
                    <AnimatedEllipse
                      animatedProps={moodEllipseProps}
                      fill={palette.terracotta}
                      stroke={textColor}
                      strokeWidth={1.5}
                    />

                    {/* Right cap — drawn last so it sits on top of the ball
                        when the ball reaches the wide end */}
                    <Ellipse
                      cx={CONE_RIGHT}
                      cy={CONE_MID_Y}
                      rx={RIGHT_RX}
                      ry={RIGHT_RY}
                      stroke={textColor}
                      strokeWidth={1.5}
                      fill="none"
                    />
                  </Svg>
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

export default memo(SessionCompleteScreenCone);

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
    fontWeight: '400',
    letterSpacing: 0.4,
    textAlign: 'center',
    marginBottom: 26,
  },
  coneTrack: {
    width: CONE_BOX_WIDTH,
    height: CONE_BOX_HEIGHT,
    position: 'relative',
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
