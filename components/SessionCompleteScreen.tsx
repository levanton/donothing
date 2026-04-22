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
import Svg, { Circle, ClipPath, Defs, G, Path, Text as SvgText, TextPath } from 'react-native-svg';

const AnimatedCircle = Animated.createAnimatedComponent(Circle);

import { Fonts } from '@/constants/theme';
import { palette, themes, type ThemeMode } from '@/lib/theme';
import { updateSessionMood } from '@/lib/db/sessions';

const EASE_OUT = Easing.bezier(0.25, 0.1, 0.25, 1);

const CONTENT_FADE_MS = 500;

const MOODS = ['still', 'calm', 'lighter', 'refreshed', 'full'] as const;

// Concentric mood rings — 5 guide circles sharing a centre, one per mood
// step. A terracotta circle in the middle grows from a tiny seed to reach
// the outermost ring as the user drags horizontally. Wider fill = fuller
// feeling.
const RING_COUNT = MOODS.length;
const RING_STEP = 22;
const RING_MAX = RING_STEP * RING_COUNT;
const RING_BOX_PAD = 28;
const LABEL_OUTSIDE = 4;
const RING_BOX_SIZE = (RING_MAX + RING_BOX_PAD) * 2;
const RING_CENTER = RING_BOX_SIZE / 2;
const FILL_MIN = 12;
// Extend past the outermost ring so the fill at max progress swallows the
// outermost label, which sits on an arc just outside ring 4.
const FILL_MAX = RING_MAX + 22;
const DRAG_TRAVEL = RING_MAX * 2;

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

interface MoodLabelProps {
  mood: string;
  index: number;
  active: boolean;
  color: string;
}

// Per-label font-size animation via requestAnimationFrame. react-native-svg's
// Text does not honour reanimated animatedProps for fontSize, so we drive the
// size through React state and ease it ourselves. The ref captures the live
// size so a new transition can start smoothly mid-animation.
const MoodLabel = memo(function MoodLabel({ mood, index, active, color }: MoodLabelProps) {
  const baseSize = 13 + index;
  const [size, setSize] = useState(baseSize);
  const sizeRef = useRef(baseSize);
  useEffect(() => {
    const from = sizeRef.current;
    const to = baseSize + (active ? 3 : 0);
    const duration = 260;
    const start = Date.now();
    let raf = 0;
    const tick = () => {
      const t = Math.min(1, (Date.now() - start) / duration);
      const eased = 1 - Math.pow(1 - t, 3);
      const next = from + (to - from) * eased;
      sizeRef.current = next;
      setSize(next);
      if (t < 1) raf = requestAnimationFrame(tick);
    };
    raf = requestAnimationFrame(tick);
    return () => cancelAnimationFrame(raf);
  }, [active, baseSize]);
  return (
    <SvgText
      fontSize={size}
      fill={color}
      fontFamily="Georgia"
      textAnchor="middle"
      letterSpacing={2 + index * 0.5}
    >
      <TextPath href={`#ring-arc-${index}`} startOffset="65%">
        {mood}
      </TextPath>
    </SvgText>
  );
});

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

  // Continuous 0..1 value — 0 starts with the smallest position (still),
  // 1 ends at the biggest (full). Stored mood is still bucketed to the
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

  const setPreviewMood = useCallback((mood: string | null) => {
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

  // Horizontal drag grows the centre circle outward toward the largest
  // ring; dragging back shrinks it. DRAG_TRAVEL worth of movement covers
  // the full 0..1 mood range.
  const circleGesture = Gesture.Pan()
    .onStart(() => {
      'worklet';
      dragStart.value = progress.value;
    })
    .onUpdate((e) => {
      'worklet';
      const next = Math.max(0, Math.min(1, dragStart.value + e.translationX / DRAG_TRAVEL));
      progress.value = next;
      // Step is the largest ring the fill has fully reached — so the
      // mood only activates when the circle physically touches its ring,
      // not as soon as the user starts dragging.
      const fillR = FILL_MIN + next * (FILL_MAX - FILL_MIN);
      let step = -1;
      for (let j = 0; j < MOODS.length; j++) {
        if (fillR >= RING_STEP * (j + 1)) step = j;
      }
      if (step !== lastHapticStep.value) {
        lastHapticStep.value = step;
        if (step >= 0) {
          runOnJS(Haptics.selectionAsync)();
          runOnJS(setPreviewMood)(MOODS[step]);
        } else {
          runOnJS(setPreviewMood)(null);
        }
      }
    })
    .onEnd(() => {
      'worklet';
      const fillR = FILL_MIN + progress.value * (FILL_MAX - FILL_MIN);
      let step = -1;
      for (let j = 0; j < MOODS.length; j++) {
        if (fillR >= RING_STEP * (j + 1)) step = j;
      }
      if (step >= 0) {
        runOnJS(commitMood)(MOODS[step]);
      }
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

  const filledCircleProps = useAnimatedProps(() => {
    const r = FILL_MIN + progress.value * (FILL_MAX - FILL_MIN);
    return { r };
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
                <View style={styles.circleTrack}>
                  <Svg
                    width={RING_BOX_SIZE}
                    height={RING_BOX_SIZE}
                    style={StyleSheet.absoluteFill}
                    pointerEvents="none"
                  >
                    <Defs>
                      {Array.from({ length: RING_COUNT }).map((_, i) => {
                        const pr = RING_STEP * (i + 1) + LABEL_OUTSIDE;
                        // CW top arc (via 12 o'clock) on a radius OUTSIDE
                        // the ring itself. startOffset 65% lands the label
                        // in the upper-right quadrant. Text reads along the
                        // tangent from upper-left to lower-right.
                        const d = `M ${RING_CENTER - pr} ${RING_CENTER} A ${pr} ${pr} 0 0 1 ${RING_CENTER + pr} ${RING_CENTER}`;
                        return <Path key={i} id={`ring-arc-${i}`} d={d} />;
                      })}
                      {/* Clip matches the growing mood fill — used to reveal
                          the cream-coloured copy of the labels only over the
                          terracotta area, so letters fade half by half. */}
                      <ClipPath id="mood-fill-clip">
                        <AnimatedCircle
                          cx={RING_CENTER}
                          cy={RING_CENTER}
                          animatedProps={filledCircleProps}
                        />
                      </ClipPath>
                    </Defs>

                    <AnimatedCircle
                      cx={RING_CENTER}
                      cy={RING_CENTER}
                      animatedProps={filledCircleProps}
                      fill={palette.terracotta}
                      stroke={textColor}
                      strokeWidth={1.2}
                    />

                    {Array.from({ length: RING_COUNT }).map((_, i) => (
                      <Circle
                        key={i}
                        cx={RING_CENTER}
                        cy={RING_CENTER}
                        r={RING_STEP * (i + 1)}
                        stroke={tertiaryText}
                        strokeWidth={1}
                        fill="none"
                      />
                    ))}

                    {MOODS.map((mood, i) => (
                      <MoodLabel
                        key={mood}
                        mood={mood}
                        index={i}
                        active={activeMood === mood}
                        color={textColor}
                      />
                    ))}

                    {/* Cream copy, revealed only where the terracotta fill
                        currently covers — gives the half-dark / half-cream
                        transition as the circle sweeps across each letter. */}
                    <G clipPath="url(#mood-fill-clip)">
                      {MOODS.map((mood, i) => (
                        <MoodLabel
                          key={`${mood}-cream`}
                          mood={mood}
                          index={i}
                          active={activeMood === mood}
                          color={palette.cream}
                        />
                      ))}
                    </G>
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
    fontWeight: '400',
    letterSpacing: 0.4,
    textAlign: 'center',
    marginBottom: 26,
  },
  circleTrack: {
    width: RING_BOX_SIZE,
    height: RING_BOX_SIZE,
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
