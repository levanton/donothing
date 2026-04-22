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
  type SharedValue,
} from 'react-native-reanimated';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import Svg, { Circle, ClipPath, Defs, G, Path, Text as SvgText, TextPath } from 'react-native-svg';

const AnimatedCircle = Animated.createAnimatedComponent(Circle);
const AnimatedSvgText = Animated.createAnimatedComponent(SvgText);

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
const SCREEN_W = Dimensions.get('window').width;
const SCREEN_H = Dimensions.get('window').height;
const GRASS_SIZE = Math.min(Math.round(SCREEN_H * 0.28), 260);

// Terracotta reveal disc — starts small at the done-button position and
// grows out to engulf the whole screen, inverting the palette. On close it
// shrinks back onto the yes button on the home screen so the handoff is
// seamless (the home yes button is already terracotta).
const SPLASH_ORIGIN_X = SCREEN_W / 2;
const SPLASH_MAX_SIZE = Math.hypot(SCREEN_W, SCREEN_H) * 2;
const YES_SIZE = 140;

interface Props {
  visible: boolean;
  sessionId: string;
  durationSeconds: number;
  todaySeconds: number;
  themeMode: ThemeMode;
  yesBtnRect?: { x: number; y: number; w: number; h: number } | null;
  onClose: () => void;
}

type Locale = 'en' | 'uk';

interface MoodLabelProps {
  mood: string;
  index: number;
  active: boolean;
  passed: boolean;
  color: string;
  reveal: SharedValue<number>;
}

// Per-label font-size animation via requestAnimationFrame. react-native-svg's
// Text does not honour reanimated animatedProps for fontSize, so we drive the
// size through React state and ease it ourselves. The ref captures the live
// size so a new transition can start smoothly mid-animation. Opacity, on the
// other hand, is handled by reanimated so the reveal stagger matches the
// ring growth frame-for-frame.
const MoodLabel = memo(function MoodLabel({ mood, index, active, passed, color, reveal }: MoodLabelProps) {
  const baseSize = 13 + index;
  const [size, setSize] = useState(baseSize);
  const sizeRef = useRef(baseSize);
  useEffect(() => {
    const from = sizeRef.current;
    const delta = active ? 4 : passed ? -1 : 0;
    const to = baseSize + delta;
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
  }, [active, passed, baseSize]);
  const opacityProps = useAnimatedProps(() => ({ opacity: reveal.value }));
  return (
    <AnimatedSvgText
      // Static 0 so the very first paint is already invisible — without
      // this the animatedProps sometimes flushes one frame late and the
      // label flashes at full opacity before the reveal animation takes
      // over.
      opacity={0}
      animatedProps={opacityProps}
      fontSize={size}
      fill={color}
      fontFamily="Georgia"
      textAnchor="middle"
      letterSpacing={2 + index * 0.5}
    >
      <TextPath href={`#ring-arc-${index}`} startOffset="65%">
        {mood}
      </TextPath>
    </AnimatedSvgText>
  );
});

// Concentric ring whose radius grows in from zero on mount, and whose stroke
// darkens as the mood fill crosses its line — giving a visible "reached"
// state that reads from the ring colour alone.
interface AnimatedRingProps {
  index: number;
  center: number;
  progress: SharedValue<number>;
  reveal: SharedValue<number>;
  mutedColor: string;
  darkColor: string;
}

const AnimatedRing = memo(function AnimatedRing({
  index, center, progress, reveal, mutedColor, darkColor,
}: AnimatedRingProps) {
  const targetR = RING_STEP * (index + 1);
  const animatedProps = useAnimatedProps(() => {
    // Pure opacity fade — the text labels sit on a fixed-radius SVG path
    // in Defs and can't follow a scaling ring, so any radius animation on
    // the ring would visibly lag the text. Fading both in at their final
    // positions keeps them glued together.
    const fillR = FILL_MIN + progress.value * (FILL_MAX - FILL_MIN);
    const tol = 4;
    const t = Math.max(0, Math.min(1, (fillR - targetR + tol) / (tol * 2)));
    const stroke = interpolateColor(t, [0, 1], [mutedColor, darkColor]);
    return { r: targetR, stroke, opacity: reveal.value };
  });
  return (
    <AnimatedCircle
      cx={center}
      cy={center}
      animatedProps={animatedProps}
      strokeWidth={1}
      fill="none"
    />
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
  yesBtnRect,
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
  const hintOpacity = useSharedValue(0);
  const hintY = useSharedValue(8);
  const splashSize = useSharedValue(0);
  const splashCx = useSharedValue(SPLASH_ORIGIN_X);
  const splashCy = useSharedValue(SCREEN_H);
  const ringReveal0 = useSharedValue(0);
  const ringReveal1 = useSharedValue(0);
  const ringReveal2 = useSharedValue(0);
  const ringReveal3 = useSharedValue(0);
  const ringReveal4 = useSharedValue(0);
  const ringReveals = [ringReveal0, ringReveal1, ringReveal2, ringReveal3, ringReveal4];

  // Continuous 0..1 value — 0 starts with the smallest position (still),
  // 1 ends at the biggest (full). Stored mood is still bucketed to the
  // 5 steps on commit.
  const progress = useSharedValue(0);
  const dragStart = useSharedValue(0);

  const [activeMood, setActiveMood] = useState<string | null>(null);
  const [hasInteracted, setHasInteracted] = useState(false);
  const statusStyle: 'light' | 'dark' = isDark ? 'light' : 'dark';

  const lastHapticStep = useSharedValue(-1);
  const dismissingRef = useRef(false);

  useEffect(() => {
    if (visible) {
      dismissingRef.current = false;
      setActiveMood(null);
      setHasInteracted(false);
      lastHapticStep.value = -1;
      progress.value = 0;

      // Hard-reset every piece first so nothing lingers from a previous
      // session — especially the done button, which must always start
      // hidden when the user lands on this screen.
      closeOpacity.value = 0;
      closeY.value = 14;
      hintOpacity.value = 0;
      hintY.value = 8;
      splashSize.value = 0;
      splashCx.value = SPLASH_ORIGIN_X;
      splashCy.value = SCREEN_H - insets.bottom - 68;
      ringReveals.forEach((sv) => { sv.value = 0; });

      // When the screen opens right after a timer ends, the JS thread is
      // briefly busy with DB writes, notification cleanup and week-stats
      // recompute. Giving every intro animation a short head-start keeps
      // the first frames from looking rushed — the splash doesn't begin
      // until that work has settled.
      const INTRO_DELAY = 240;
      splashSize.value = withDelay(
        INTRO_DELAY,
        withTiming(SPLASH_MAX_SIZE, { duration: 980, easing: EASE_OUT }),
      );
      contentOpacity.value = withDelay(
        INTRO_DELAY,
        withTiming(1, { duration: CONTENT_FADE_MS + 120, easing: EASE_OUT }),
      );

      const base = INTRO_DELAY + 600;
      glowOpacity.value = withDelay(base, withTiming(1, { duration: 1400, easing: EASE_OUT }));
      glowScale.value = withDelay(base, withTiming(1, { duration: 1400, easing: EASE_OUT }));

      titleOpacity.value = withDelay(base, withTiming(1, { duration: 1100, easing: EASE_OUT }));
      titleY.value = withDelay(base, withTiming(0, { duration: 1100, easing: EASE_OUT }));
      titleScale.value = withDelay(base, withTiming(1, { duration: 1200, easing: EASE_OUT }));

      subtitleOpacity.value = withDelay(base + 500, withTiming(1, { duration: 850, easing: EASE_OUT }));
      subtitleY.value = withDelay(base + 500, withTiming(0, { duration: 850, easing: EASE_OUT }));

      circleBlockOpacity.value = withDelay(base + 900, withTiming(1, { duration: 750, easing: EASE_OUT }));
      circleBlockY.value = withDelay(base + 900, withTiming(0, { duration: 750, easing: EASE_OUT }));

      // Rings grow from the middle outwards, smallest first. Each ring's
      // reveal also drives its label's opacity so the label fades in just
      // as its ring finishes settling.
      const ringRevealBase = base + 1200;
      const ringStride = 150;
      const ringDuration = 720;
      ringReveals.forEach((sv, i) => {
        sv.value = withDelay(
          ringRevealBase + i * ringStride,
          withTiming(1, { duration: ringDuration, easing: EASE_OUT }),
        );
      });

      // Hint waits until every ring is visible before inviting the drag.
      const hintDelay = ringRevealBase + (ringReveals.length - 1) * ringStride + ringDuration - 100;
      hintOpacity.value = withDelay(hintDelay, withTiming(1, { duration: 600, easing: EASE_OUT }));
      hintY.value = withDelay(hintDelay, withTiming(0, { duration: 600, easing: EASE_OUT }));
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
      hintOpacity.value = 0;
      hintY.value = 8;
      splashSize.value = 0;
      ringReveals.forEach((sv) => { sv.value = 0; });
      setHasInteracted(false);
    }
  }, [visible]);

  const setPreviewMood = useCallback((mood: string | null) => {
    setActiveMood(mood);
    if (mood !== null) setHasInteracted(true);
  }, []);

  // Once the user touches the first ring, swap the hint for the done
  // button. Depends ONLY on hasInteracted so a stale `true` can't survive
  // a re-entry — visible=true always resets the flag to false first.
  useEffect(() => {
    if (!hasInteracted) return;
    hintOpacity.value = withTiming(0, { duration: 320, easing: EASE_OUT });
    closeOpacity.value = withTiming(1, { duration: 520, easing: EASE_OUT });
    closeY.value = withTiming(0, { duration: 520, easing: EASE_OUT });
  }, [hasInteracted]);

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

    // Collapse the terracotta disc back onto the home-screen yes button —
    // same shape, same colour, so the handoff is seamless (mirrors the
    // launch splash). If we don't have a measured yes button yet, just
    // shrink to 0 at the current origin.
    const duration = 540;
    if (yesBtnRect) {
      splashCx.value = withTiming(yesBtnRect.x + yesBtnRect.w / 2, { duration, easing: EASE_OUT });
      splashCy.value = withTiming(yesBtnRect.y + yesBtnRect.h / 2, { duration, easing: EASE_OUT });
      splashSize.value = withTiming(YES_SIZE, { duration, easing: EASE_OUT });
    } else {
      splashSize.value = withTiming(0, { duration, easing: EASE_OUT });
    }

    contentOpacity.value = withTiming(0, { duration: 420, easing: EASE_OUT });
    setTimeout(onClose, duration + 20);
  }, [onClose, yesBtnRect]);

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
  }));

  const splashAnimStyle = useAnimatedStyle(() => {
    const size = splashSize.value;
    return {
      width: size,
      height: size,
      borderRadius: size / 2,
      left: splashCx.value - size / 2,
      top: splashCy.value - size / 2,
    };
  });
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
    pointerEvents: closeOpacity.value > 0.5 ? 'auto' : 'none',
  }));
  const hintStyle = useAnimatedStyle(() => ({
    opacity: hintOpacity.value,
    transform: [{ translateY: hintY.value }],
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

  // Inverse palette — the reveal disc fills the screen with terracotta, so
  // every label on top of it is cream, and the mood circle in the middle
  // becomes cream-filled with dark text inside.
  const textColor = palette.cream;
  const softText = 'rgba(249, 242, 224, 0.85)';
  const tertiaryText = 'rgba(249, 242, 224, 0.5)';
  const clippedLabelColor = palette.brown;

  const duration = formatMinutes(durationSeconds);
  const today = formatMinutes(todaySeconds);

  return (
    <View style={styles.root}>
      <StatusBar style={statusStyle} />

      {/* Terracotta reveal disc grows from the done-button position to
          cover the screen before any content fades in. */}
      <Animated.View pointerEvents="none" style={[styles.splashCircle, splashAnimStyle]} />

      {/* Content layer — transparent, lives on top of the terracotta disc */}
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
                      fill={palette.cream}
                    />

                    {ringReveals.map((reveal, i) => (
                      <AnimatedRing
                        key={i}
                        index={i}
                        center={RING_CENTER}
                        progress={progress}
                        reveal={reveal}
                        mutedColor={tertiaryText}
                        darkColor={palette.brown}
                      />
                    ))}

                    {MOODS.map((mood, i) => {
                      const activeIndex = activeMood ? MOODS.indexOf(activeMood as typeof MOODS[number]) : -1;
                      return (
                        <MoodLabel
                          key={mood}
                          mood={mood}
                          index={i}
                          active={i === activeIndex}
                          passed={activeIndex > i}
                          color={textColor}
                          reveal={ringReveals[i]}
                        />
                      );
                    })}

                    {/* Cream copy, revealed only where the terracotta fill
                        currently covers — gives the half-dark / half-cream
                        transition as the circle sweeps across each letter. */}
                    <G clipPath="url(#mood-fill-clip)">
                      {MOODS.map((mood, i) => {
                        const activeIndex = activeMood ? MOODS.indexOf(activeMood as typeof MOODS[number]) : -1;
                        return (
                          <MoodLabel
                            key={`${mood}-cream`}
                            mood={mood}
                            index={i}
                            active={i === activeIndex}
                            passed={activeIndex > i}
                            color={clippedLabelColor}
                            reveal={ringReveals[i]}
                          />
                        );
                      })}
                    </G>
                  </Svg>
                </View>
              </GestureDetector>

              <Animated.Text
                style={[
                  styles.hint,
                  { color: tertiaryText, fontFamily: Fonts.serif },
                  hintStyle,
                ]}
              >
                drag outward
              </Animated.Text>
            </Animated.View>
          </View>

          <Animated.View style={closeStyleAnim}>
            <Pressable onPress={handleClose}>
              <View style={[styles.doneBtn, { backgroundColor: palette.cream }]}>
                <Text style={[styles.doneLabel, { color: palette.brown, fontFamily: Fonts.serif }]}>
                  done
                </Text>
              </View>
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
    overflow: 'hidden',
  },
  splashCircle: {
    position: 'absolute',
    backgroundColor: palette.terracotta,
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
    // Italic `f` in "yourself" clips on the right without a trailing pad.
    paddingHorizontal: 6,
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
    marginTop: 24,
  },
  prompt: {
    fontSize: 22,
    fontWeight: '400',
    fontStyle: 'italic',
    letterSpacing: 0.3,
    textAlign: 'center',
    marginBottom: 18,
  },
  hint: {
    fontSize: 14,
    fontWeight: '400',
    fontStyle: 'italic',
    letterSpacing: 0.5,
    textAlign: 'center',
    marginTop: 18,
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
