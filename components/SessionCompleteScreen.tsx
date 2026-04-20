import { memo, useCallback, useEffect, useRef, useState } from 'react';
import { Dimensions, Image, Pressable, StyleSheet, Text, View } from 'react-native';
import { StatusBar } from 'expo-status-bar';
import * as Haptics from 'expo-haptics';
import { Gesture, GestureDetector } from 'react-native-gesture-handler';
import Animated, {
  Easing,
  Extrapolation,
  interpolate,
  interpolateColor,
  runOnJS,
  useAnimatedStyle,
  useDerivedValue,
  useSharedValue,
  withDelay,
  withRepeat,
  withSequence,
  withTiming,
} from 'react-native-reanimated';
import { useSafeAreaInsets } from 'react-native-safe-area-context';

import { Fonts } from '@/constants/theme';
import { themes, type ThemeMode } from '@/lib/theme';
import { updateSessionMood } from '@/lib/db/sessions';

const EASE_OUT = Easing.bezier(0.25, 0.1, 0.25, 1);

const CONTENT_FADE_MS = 500;

const MOODS = ['restless', 'calm', 'lighter', 'refreshed', 'grateful'] as const;
// Colors per mood — maps roughly to their emotional tone. Drives the thumb
// colour morph and the page's subtle background wash.
const MOOD_COLORS = [
  '#C75B3A', // restless — warm red
  '#4E6D80', // calm — deep slate blue
  '#E0A653', // lighter — amber
  '#5D8F5B', // refreshed — forest green
  '#DF5C44', // grateful — terracotta (app accent)
] as const;

const SLIDER_W = 300;
const THUMB_SIZE = 32;
const HALO_SIZE = 60;
const TRACK_H = 4;
const SLIDER_TOUCH_H = 64;
const SLIDER_TRAVEL = SLIDER_W - THUMB_SIZE;
const TRACK_TOP = (SLIDER_TOUCH_H - TRACK_H) / 2;
const THUMB_TOP = (SLIDER_TOUCH_H - THUMB_SIZE) / 2;
const HALO_TOP = (SLIDER_TOUCH_H - HALO_SIZE) / 2;

// Per-mood background tints — subtle base-tone washes that pick up the current
// mood's hue so the whole screen breathes with the selection.
const MOOD_BG_LIGHT = [
  '#F3E4DC', // restless — warm pinkish cream
  '#E6EAEE', // calm — cool blue-grey cream
  '#F9EAC8', // lighter — amber cream
  '#E6EEDE', // refreshed — soft green cream
  '#F9DFD4', // grateful — warm terracotta cream
] as const;

const MOOD_BG_DARK = [
  '#574742', // restless — warm charcoal
  '#474A4D', // calm — cool charcoal
  '#5B5342', // lighter — amber charcoal
  '#484F47', // refreshed — green charcoal
  '#5B4842', // grateful — terracotta charcoal
] as const;

// Mood colours at low alpha — used to tint the "carry on" button so it carries
// the current emotional hue without becoming loud.
const MOOD_SOFT = [
  'rgba(199, 91, 58, 0.32)',
  'rgba(78, 109, 128, 0.32)',
  'rgba(224, 166, 83, 0.32)',
  'rgba(93, 143, 91, 0.32)',
  'rgba(223, 92, 68, 0.32)',
] as const;

const grassImage = require('@/assets/images/grass.png');
const SCREEN_H = Dimensions.get('window').height;
const GRASS_SIZE = Math.min(Math.round(SCREEN_H * 0.36), 340);

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
  const MOOD_BG = isDark ? MOOD_BG_DARK : MOOD_BG_LIGHT;

  const contentOpacity = useSharedValue(0);

  const glowOpacity = useSharedValue(0);
  const glowScale = useSharedValue(0.94);
  const titleOpacity = useSharedValue(0);
  const titleY = useSharedValue(14);
  const titleScale = useSharedValue(0.96);
  const subtitleOpacity = useSharedValue(0);
  const subtitleY = useSharedValue(12);
  const sliderOpacity = useSharedValue(0);
  const sliderY = useSharedValue(12);
  const closeOpacity = useSharedValue(0);
  const closeY = useSharedValue(14);

  // Slider
  const thumbX = useSharedValue(SLIDER_TRAVEL / 2); // start at middle
  const thumbPulse = useSharedValue(1);              // breath pulse
  const ripple = useSharedValue(0);                   // expands on mood change

  const [activeMood, setActiveMood] = useState<string | null>(null);
  const statusStyle: 'light' | 'dark' = isDark ? 'light' : 'dark';

  const lastHapticStep = useSharedValue(-1);
  const dismissingRef = useRef(false);

  useEffect(() => {
    if (visible) {
      dismissingRef.current = false;
      setActiveMood(null);
      lastHapticStep.value = -1;
      thumbX.value = SLIDER_TRAVEL / 2;

      contentOpacity.value = withTiming(1, { duration: CONTENT_FADE_MS, easing: EASE_OUT });

      // Cinematic entrance — each block slides up while fading in, unified tempo
      const base = 220;
      glowOpacity.value = withDelay(base - 80, withTiming(1, { duration: 1400, easing: EASE_OUT }));
      glowScale.value = withDelay(base - 80, withTiming(1, { duration: 1400, easing: EASE_OUT }));

      titleOpacity.value = withDelay(base, withTiming(1, { duration: 1100, easing: EASE_OUT }));
      titleY.value = withDelay(base, withTiming(0, { duration: 1100, easing: EASE_OUT }));
      titleScale.value = withDelay(base, withTiming(1, { duration: 1200, easing: EASE_OUT }));

      subtitleOpacity.value = withDelay(base + 500, withTiming(1, { duration: 850, easing: EASE_OUT }));
      subtitleY.value = withDelay(base + 500, withTiming(0, { duration: 850, easing: EASE_OUT }));

      sliderOpacity.value = withDelay(base + 900, withTiming(1, { duration: 750, easing: EASE_OUT }));
      sliderY.value = withDelay(base + 900, withTiming(0, { duration: 750, easing: EASE_OUT }));

      closeOpacity.value = withDelay(base + 1300, withTiming(1, { duration: 650, easing: EASE_OUT }));
      closeY.value = withDelay(base + 1300, withTiming(0, { duration: 650, easing: EASE_OUT }));

      thumbPulse.value = withDelay(
        base + 1000,
        withRepeat(
          withSequence(
            withTiming(1.08, { duration: 1400, easing: Easing.inOut(Easing.ease) }),
            withTiming(1.0, { duration: 1400, easing: Easing.inOut(Easing.ease) }),
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
      sliderOpacity.value = 0;
      sliderY.value = 12;
      closeOpacity.value = 0;
      closeY.value = 14;
      thumbPulse.value = 1;
      ripple.value = 0;
    }
  }, [visible]);

  // Updates the spectrum row highlight live while the user drags.
  // No DB write here — we only persist on gesture end (commitMood).
  const setPreviewMood = useCallback((mood: string) => {
    setActiveMood(mood);
  }, []);

  const commitMood = useCallback(
    (mood: string) => {
      if (sessionId) updateSessionMood(sessionId, mood);
      ripple.value = 0;
      ripple.value = withTiming(1, { duration: 650, easing: Easing.out(Easing.ease) });
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

  const sliderGesture = Gesture.Pan()
    .onUpdate((e) => {
      'worklet';
      const x = Math.max(0, Math.min(SLIDER_TRAVEL, e.x - THUMB_SIZE / 2));
      thumbX.value = x;
      const step = Math.round((x / SLIDER_TRAVEL) * (MOODS.length - 1));
      if (step !== lastHapticStep.value) {
        lastHapticStep.value = step;
        runOnJS(Haptics.selectionAsync)();
        runOnJS(setPreviewMood)(MOODS[step]);
      }
    })
    .onEnd(() => {
      'worklet';
      const step = Math.round((thumbX.value / SLIDER_TRAVEL) * (MOODS.length - 1));
      const snapped = (step / (MOODS.length - 1)) * SLIDER_TRAVEL;
      thumbX.value = withTiming(snapped, { duration: 220, easing: EASE_OUT });
      runOnJS(commitMood)(MOODS[step]);
    });

  // Thumb color interpolation based on position along the track.
  const colorStops = MOODS.map((_, i) => (i / (MOODS.length - 1)) * SLIDER_TRAVEL);
  const thumbColor = useDerivedValue(() =>
    interpolateColor(thumbX.value, colorStops, MOOD_COLORS),
  );

  const bgStops = MOODS.map((_, i) => (i / (MOODS.length - 1)) * SLIDER_TRAVEL);
  const contentStyle = useAnimatedStyle(() => ({
    opacity: contentOpacity.value,
    pointerEvents: contentOpacity.value > 0.5 ? 'auto' : 'none',
    backgroundColor: interpolateColor(thumbX.value, bgStops, MOOD_BG as unknown as string[]),
  }));
  const titleStyle = useAnimatedStyle(() => ({
    opacity: titleOpacity.value,
    transform: [{ translateY: titleY.value }, { scale: titleScale.value }],
  }));
  const subtitleStyle = useAnimatedStyle(() => ({
    opacity: subtitleOpacity.value,
    transform: [{ translateY: subtitleY.value }],
  }));
  const sliderStyleAnim = useAnimatedStyle(() => ({
    opacity: sliderOpacity.value,
    transform: [{ translateY: sliderY.value }],
  }));
  const closeStyleAnim = useAnimatedStyle(() => ({
    opacity: closeOpacity.value,
    transform: [{ translateY: closeY.value }],
  }));

  // Mood-tinted background for the "carry on" button — carries the current hue.
  const doneBgStyle = useAnimatedStyle(() => ({
    backgroundColor: interpolateColor(thumbX.value, bgStops, MOOD_SOFT as unknown as string[]),
  }));

  // Grass illustration — the emotional anchor at the top of the screen.
  const glowWrapStyle = useAnimatedStyle(() => ({
    opacity: glowOpacity.value,
    transform: [{ scale: glowScale.value }],
  }));

  const thumbStyle = useAnimatedStyle(() => ({
    transform: [
      { translateX: thumbX.value },
      { scale: thumbPulse.value },
    ],
    backgroundColor: thumbColor.value,
  }));

  // Mood-tinted fill under the thumb — a soft underline that carries the colour
  // from the left edge up to the thumb's current position.
  const fillStyle = useAnimatedStyle(() => ({
    width: thumbX.value + THUMB_SIZE / 2,
    backgroundColor: thumbColor.value,
    opacity: 0.42,
  }));

  // Soft halo that follows the thumb — a diffuse glow in the mood colour.
  const haloStyle = useAnimatedStyle(() => ({
    transform: [{ translateX: thumbX.value - (HALO_SIZE - THUMB_SIZE) / 2 }],
    backgroundColor: thumbColor.value,
    opacity: 0.18,
  }));

  // Ripple that expands out of the thumb on mood confirm.
  const rippleStyle = useAnimatedStyle(() => ({
    opacity: interpolate(ripple.value, [0, 0.25, 1], [0, 0.28, 0], Extrapolation.CLAMP),
    transform: [
      { translateX: thumbX.value },
      { scale: interpolate(ripple.value, [0, 1], [1, 2.8], Extrapolation.CLAMP) },
    ],
    backgroundColor: thumbColor.value,
  }));

  if (!visible) return null;

  const textColor = theme.text;
  const softText = theme.textSecondary;
  const tertiaryText = theme.textTertiary;
  const trackColor = isDark ? 'rgba(249, 242, 224, 0.18)' : 'rgba(51, 52, 49, 0.12)';
  const tickColor = isDark ? 'rgba(249, 242, 224, 0.32)' : 'rgba(51, 52, 49, 0.22)';

  const duration = formatMinutes(durationSeconds);
  const today = formatMinutes(todaySeconds);

  return (
    <View style={styles.root}>
      <StatusBar style={statusStyle} />

      {/* Cream background + content layer — revealed after black */}
      <Animated.View
        style={[StyleSheet.absoluteFillObject, contentStyle]}
      >
        <View
          style={[
            styles.layout,
            { paddingTop: insets.top + 32, paddingBottom: insets.bottom + 40 },
          ]}
        >
          {/* Centered content group — summary + interaction share the optical centre */}
          <View style={styles.centerGroup}>
            <View style={styles.summary}>
              {/* Grass illustration — same asset as the onboarding "lying in the grass" screen */}
              <Animated.View style={[styles.grassWrap, glowWrapStyle]} pointerEvents="none">
                <Image source={grassImage} style={styles.grassImage} fadeDuration={0} />
              </Animated.View>

              <Animated.View style={[styles.titleBlock, titleStyle]}>
                <Text
                  style={[
                    styles.titleMain,
                    { color: textColor, fontFamily: Fonts.serif },
                  ]}
                >
                  {duration.value} {duration.unit}
                </Text>
                <Text
                  style={[
                    styles.titleSub,
                    { color: textColor, fontFamily: Fonts.serif },
                  ]}
                >
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

            <Animated.View style={[styles.interaction, sliderStyleAnim]}>
              {/* Prompt above the slider — transforms from question to statement */}
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

              <GestureDetector gesture={sliderGesture}>
                <View style={styles.sliderTouch}>
                  {/* Neutral track */}
                  <View style={[styles.track, { backgroundColor: trackColor }]} />

                  {/* Mood-tinted fill up to the thumb */}
                  <Animated.View pointerEvents="none" style={[styles.trackFill, fillStyle]} />

                  {/* Tiny tick dots — 5 quiet positions on the line */}
                  {MOODS.map((_, i) => {
                    const cx = (i / (MOODS.length - 1)) * SLIDER_TRAVEL + THUMB_SIZE / 2;
                    return (
                      <View
                        key={i}
                        pointerEvents="none"
                        style={[
                          styles.tick,
                          { left: cx - 2, backgroundColor: tickColor },
                        ]}
                      />
                    );
                  })}

                  {/* Soft halo glow following the thumb */}
                  <Animated.View pointerEvents="none" style={[styles.halo, haloStyle]} />

                  {/* Ripple burst on mood confirm */}
                  <Animated.View pointerEvents="none" style={[styles.ripple, rippleStyle]} />

                  {/* Draggable thumb — ring matches page bg for clean cutout */}
                  <Animated.View
                    pointerEvents="none"
                    style={[styles.thumb, { borderColor: theme.bg }, thumbStyle]}
                  />
                </View>
              </GestureDetector>

              {/* Mood spectrum — active one carries colour + weight (no size shift) */}
              <View style={styles.moodRow} pointerEvents="none">
                {MOODS.map((mood, i) => {
                  const isActive = mood === activeMood;
                  return (
                    <Text
                      key={mood}
                      style={[
                        styles.moodRowLabel,
                        {
                          color: isActive ? MOOD_COLORS[i] : tertiaryText,
                          fontFamily: Fonts.serif,
                          fontWeight: isActive ? '600' : '400',
                        },
                      ]}
                      numberOfLines={1}
                    >
                      {mood}
                    </Text>
                  );
                })}
              </View>

            </Animated.View>
          </View>

          {/* "carry on" — the button carries the current mood's hue,
              inviting the user to step back into their day */}
          <Animated.View style={closeStyleAnim}>
            <Pressable onPress={handleClose}>
              <Animated.View style={[styles.doneBtn, doneBgStyle]}>
                <Text
                  style={[
                    styles.doneLabel,
                    { color: textColor, fontFamily: Fonts.serif },
                  ]}
                >
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
    width: SLIDER_W + 40,
    marginTop: 80,
  },
  prompt: {
    fontSize: 15,
    fontWeight: '300',
    fontStyle: 'italic',
    letterSpacing: 0.4,
    textAlign: 'center',
    marginBottom: 26,
  },
  sliderTouch: {
    width: SLIDER_W,
    height: SLIDER_TOUCH_H,
    justifyContent: 'center',
  },
  track: {
    position: 'absolute',
    height: TRACK_H,
    width: SLIDER_W,
    top: TRACK_TOP,
    left: 0,
    borderRadius: TRACK_H / 2,
  },
  trackFill: {
    position: 'absolute',
    height: TRACK_H,
    top: TRACK_TOP,
    left: 0,
    borderRadius: TRACK_H / 2,
  },
  tick: {
    position: 'absolute',
    width: 4,
    height: 4,
    borderRadius: 2,
    top: TRACK_TOP + (TRACK_H - 4) / 2,
  },
  halo: {
    position: 'absolute',
    width: HALO_SIZE,
    height: HALO_SIZE,
    borderRadius: HALO_SIZE / 2,
    top: HALO_TOP,
    left: 0,
  },
  ripple: {
    position: 'absolute',
    width: THUMB_SIZE,
    height: THUMB_SIZE,
    borderRadius: THUMB_SIZE / 2,
    top: THUMB_TOP,
    left: 0,
  },
  thumb: {
    width: THUMB_SIZE,
    height: THUMB_SIZE,
    borderRadius: THUMB_SIZE / 2,
    position: 'absolute',
    top: THUMB_TOP,
    left: 0,
    borderWidth: 3,
    shadowColor: '#000',
    shadowOpacity: 0.16,
    shadowRadius: 10,
    shadowOffset: { width: 0, height: 4 },
  },
  moodRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    width: SLIDER_W + 20,
    marginTop: 24,
    paddingHorizontal: 0,
  },
  moodRowLabel: {
    fontSize: 13,
    letterSpacing: 0.3,
    textAlign: 'center',
    flex: 1,
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
