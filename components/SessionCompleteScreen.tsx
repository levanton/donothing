import { memo, useCallback, useEffect, useRef, useState } from 'react';
import { Dimensions, Image, Pressable, StyleSheet, Text, View } from 'react-native';
import { StatusBar } from 'expo-status-bar';
import * as Haptics from 'expo-haptics';
import Animated, {
  Easing,
  useAnimatedStyle,
  useSharedValue,
  withDelay,
  withTiming,
} from 'react-native-reanimated';
import { useSafeAreaInsets } from 'react-native-safe-area-context';

import { Fonts } from '@/constants/theme';
import { palette, themes, type ThemeMode } from '@/lib/theme';
import MoodDial, { MOOD_DIAL_DISC_DURATION } from '@/components/MoodDial';

const EASE_OUT = Easing.bezier(0.25, 0.1, 0.25, 1);

const CONTENT_FADE_MS = 500;

const grassImage = require('@/assets/images/sun.png');
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

  const [hasInteracted, setHasInteracted] = useState(false);
  const [revealDial, setRevealDial] = useState(false);
  const revealTimersRef = useRef<Array<ReturnType<typeof setTimeout>>>([]);
  const statusStyle: 'light' | 'dark' = isDark ? 'light' : 'dark';

  const dismissingRef = useRef(false);
  const prevVisibleRef = useRef(false);

  // Reset React state SYNCHRONOUSLY during render the moment visible
  // flips — otherwise the first paint after re-entry uses the previous
  // session's state and the re-open animations never show.
  if (visible && !prevVisibleRef.current) {
    prevVisibleRef.current = true;
    setHasInteracted(false);
    setRevealDial(false);
  } else if (!visible && prevVisibleRef.current) {
    prevVisibleRef.current = false;
    setHasInteracted(false);
    setRevealDial(false);
  }

  useEffect(() => {
    if (visible) {
      dismissingRef.current = false;
      setHasInteracted(false);
      setRevealDial(false);

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
      revealTimersRef.current.forEach(clearTimeout);
      revealTimersRef.current = [];

      // When the screen opens right after a timer ends, the JS thread is
      // briefly busy with DB writes, notification cleanup and week-stats
      // recompute. Giving every intro animation a short head-start keeps
      // the first frames from looking rushed — the splash doesn't begin
      // until that work has settled.
      const INTRO_DELAY = 240;
      splashSize.value = withDelay(
        INTRO_DELAY,
        withTiming(SPLASH_MAX_SIZE, { duration: 820, easing: EASE_OUT }),
      );
      contentOpacity.value = withDelay(
        INTRO_DELAY,
        withTiming(1, { duration: CONTENT_FADE_MS + 120, easing: EASE_OUT }),
      );

      // Content first, dial last: title / subtitle / prompt / circle
      // block all cascade in from `base`. The mood dial (disc + rings +
      // labels) animates at the very end as a single breath.
      const base = INTRO_DELAY + 440;
      glowOpacity.value = withDelay(base, withTiming(1, { duration: 1400, easing: EASE_OUT }));
      glowScale.value = withDelay(base, withTiming(1, { duration: 1400, easing: EASE_OUT }));

      titleOpacity.value = withDelay(base, withTiming(1, { duration: 1100, easing: EASE_OUT }));
      titleY.value = withDelay(base, withTiming(0, { duration: 1100, easing: EASE_OUT }));
      titleScale.value = withDelay(base, withTiming(1, { duration: 1200, easing: EASE_OUT }));

      subtitleOpacity.value = withDelay(base + 500, withTiming(1, { duration: 850, easing: EASE_OUT }));
      subtitleY.value = withDelay(base + 500, withTiming(0, { duration: 850, easing: EASE_OUT }));

      circleBlockOpacity.value = withDelay(base + 900, withTiming(1, { duration: 750, easing: EASE_OUT }));
      circleBlockY.value = withDelay(base + 900, withTiming(0, { duration: 750, easing: EASE_OUT }));

      // Mood dial reveals after everything else is on screen.
      const DIAL_START = base + 1300;
      revealTimersRef.current.push(
        setTimeout(() => setRevealDial(true), DIAL_START),
      );

      // Hint waits until the dial has finished its sweep.
      const hintDelay = DIAL_START + MOOD_DIAL_DISC_DURATION + 120;
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
      revealTimersRef.current.forEach(clearTimeout);
      revealTimersRef.current = [];
      setHasInteracted(false);
      setRevealDial(false);
    }
  }, [visible]);

  const handleDialInteract = useCallback(() => {
    setHasInteracted(true);
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

  const glowWrapStyle = useAnimatedStyle(() => ({
    opacity: glowOpacity.value,
    transform: [{ scale: glowScale.value }],
  }));


  if (!visible) return null;

  // Screen bg is terracotta, so title / prompt / subtitle / hint (all
  // drawn on that bg) stay cream. The mood circle has flipped: the canvas
  // disc is cream and the user-driven fill is terracotta, so the ring
  // Screen bg is terracotta, so title / prompt / subtitle / hint stay
  // cream. Ring strokes and ring labels stay dark on the cream disc — no
  // colour switch when the fill crosses them.
  const textColor = palette.cream;
  const softText = 'rgba(249, 242, 224, 0.85)';
  const tertiaryText = 'rgba(249, 242, 224, 0.5)';

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

            <View style={styles.interaction}>
              <Animated.Text
                style={[
                  styles.prompt,
                  { color: textColor, fontFamily: Fonts.serif },
                  circleBlockStyle,
                ]}
              >
                how full do you feel?
              </Animated.Text>

              <MoodDial
                visible={visible}
                reveal={revealDial}
                sessionId={sessionId}
                onInteract={handleDialInteract}
              />

              <Animated.Text
                style={[
                  styles.hint,
                  { color: tertiaryText, fontFamily: Fonts.serif },
                  hintStyle,
                ]}
              >
                drag outward
              </Animated.Text>
            </View>
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
    // sun.png is 780×450, so use its native aspect ratio instead of a
    // square — otherwise contain leaves blank vertical space that reads
    // as an awkward gap between the image and the title below.
    height: GRASS_SIZE * (450 / 780),
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
