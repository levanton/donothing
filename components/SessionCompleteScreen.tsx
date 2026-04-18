import { memo, useCallback, useEffect, useRef, useState } from 'react';
import { StyleSheet, Text, View } from 'react-native';
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
import Svg, { Path } from 'react-native-svg';
import { LinearGradient } from 'expo-linear-gradient';
import { useSafeAreaInsets } from 'react-native-safe-area-context';

import { Fonts } from '@/constants/theme';
import { palette } from '@/lib/theme';
import { updateSessionMood } from '@/lib/db/sessions';
import PillButton from '@/components/PillButton';

const EASE_OUT = Easing.bezier(0.25, 0.1, 0.25, 1);

const CONTENT_FADE_MS = 500;

const MOODS = ['restless', 'calm', 'lighter', 'refreshed', 'grateful'] as const;
// Colors per mood — maps roughly to their emotional tone. Used for thumb morph
// and the gradient track behind it.
const MOOD_COLORS = [
  '#B55D4F', // restless — muted red
  '#6B7A85', // calm — muted slate blue
  '#D9B383', // lighter — warm sand
  '#8AA885', // refreshed — sage green
  '#DF5C44', // grateful — terracotta (app accent)
] as const;

const SLIDER_W = 260;
const THUMB_SIZE = 22;
const SLIDER_TRAVEL = SLIDER_W - THUMB_SIZE;

interface Props {
  visible: boolean;
  sessionId: string;
  durationSeconds: number;
  todaySeconds: number;
  onClose: () => void;
}

function EnsoSymbol({ color, size = 84 }: { color: string; size?: number }) {
  const r = size / 2 - 3;
  const cx = size / 2;
  const cy = size / 2;
  const startAngle = (20 * Math.PI) / 180;
  const endAngle = (320 * Math.PI) / 180;
  const x1 = cx + r * Math.cos(startAngle);
  const y1 = cy + r * Math.sin(startAngle);
  const x2 = cx + r * Math.cos(endAngle);
  const y2 = cy + r * Math.sin(endAngle);
  const d = `M ${x1} ${y1} A ${r} ${r} 0 1 1 ${x2} ${y2}`;
  return (
    <Svg width={size} height={size} style={{ transform: [{ rotate: '-30deg' }] }}>
      <Path
        d={d}
        stroke={color}
        strokeWidth={2.2}
        strokeLinecap="round"
        fill="none"
      />
    </Svg>
  );
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

// Background tints for the mood slider. Cream stays as the center value;
// extremes are subtle ±hue shifts (cooler at "restless", warmer toward
// "grateful") that the user feels rather than sees.
const BG_COOL = '#F4F1E4';
const BG_WARM = '#FCEED8';

function SessionCompleteScreen({
  visible,
  sessionId,
  durationSeconds,
  todaySeconds,
  onClose,
}: Props) {
  const insets = useSafeAreaInsets();

  const contentOpacity = useSharedValue(0);

  const ensoOpacity = useSharedValue(0);
  const ensoScale = useSharedValue(0.94);
  const ensoBreath = useSharedValue(1);
  const titleOpacity = useSharedValue(0);
  const titleY = useSharedValue(8);
  const subtitleOpacity = useSharedValue(0);
  const sliderOpacity = useSharedValue(0);
  const closeOpacity = useSharedValue(0);

  // Slider
  const thumbX = useSharedValue(SLIDER_TRAVEL / 2); // start at middle
  const thumbPulse = useSharedValue(1);              // breath pulse
  const ripple = useSharedValue(0);                   // expands on mood change

  const [activeMood, setActiveMood] = useState<string | null>(null);
  const [displayedMood, setDisplayedMood] = useState<string>('how do you feel?');
  const [statusStyle, setStatusStyle] = useState<'light' | 'dark'>('light');

  const lastHapticStep = useRef(-1);
  const dismissingRef = useRef(false);

  useEffect(() => {
    if (visible) {
      dismissingRef.current = false;
      setActiveMood(null);
      setDisplayedMood('how do you feel?');
      setStatusStyle('dark');
      lastHapticStep.current = -1;
      thumbX.value = SLIDER_TRAVEL / 2;

      contentOpacity.value = withTiming(1, { duration: CONTENT_FADE_MS, easing: EASE_OUT });

      // Staggered content entrance
      const base = 150;
      ensoOpacity.value = withDelay(base, withTiming(1, { duration: 900, easing: EASE_OUT }));
      ensoScale.value = withDelay(base, withTiming(1, { duration: 1100, easing: EASE_OUT }));
      titleOpacity.value = withDelay(base + 400, withTiming(1, { duration: 700, easing: EASE_OUT }));
      titleY.value = withDelay(base + 400, withTiming(0, { duration: 700, easing: EASE_OUT }));
      subtitleOpacity.value = withDelay(base + 700, withTiming(1, { duration: 600, easing: EASE_OUT }));
      sliderOpacity.value = withDelay(base + 1000, withTiming(1, { duration: 600, easing: EASE_OUT }));
      closeOpacity.value = withDelay(base + 1400, withTiming(1, { duration: 500, easing: EASE_OUT }));

      // Breathing loops — begin once ensō is in view
      ensoBreath.value = withDelay(
        base + 400,
        withRepeat(
          withSequence(
            withTiming(1.03, { duration: 3200, easing: Easing.inOut(Easing.ease) }),
            withTiming(0.98, { duration: 3200, easing: Easing.inOut(Easing.ease) }),
          ),
          -1,
          false,
        ),
      );
      thumbPulse.value = withDelay(
        base + 1200,
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
      ensoOpacity.value = 0;
      ensoScale.value = 0.94;
      ensoBreath.value = 1;
      titleOpacity.value = 0;
      titleY.value = 8;
      subtitleOpacity.value = 0;
      sliderOpacity.value = 0;
      closeOpacity.value = 0;
      thumbPulse.value = 1;
      ripple.value = 0;
    }
  }, [visible]);

  // Updates the label + mood row highlight live while the user drags.
  // No DB write here — we only persist on gesture end (commitMood).
  const setPreviewMood = useCallback((mood: string) => {
    setActiveMood(mood);
    setDisplayedMood(mood);
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
      if (step !== lastHapticStep.current) {
        lastHapticStep.current = step;
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

  const contentStyle = useAnimatedStyle(() => ({
    opacity: contentOpacity.value,
    pointerEvents: contentOpacity.value > 0.5 ? 'auto' : 'none',
    backgroundColor: interpolateColor(
      thumbX.value,
      [0, SLIDER_TRAVEL / 2, SLIDER_TRAVEL],
      [BG_COOL, palette.cream, BG_WARM],
    ),
  }));
  const ensoStyle = useAnimatedStyle(() => ({
    opacity: ensoOpacity.value,
    transform: [{ scale: ensoScale.value * ensoBreath.value }],
  }));
  const titleStyle = useAnimatedStyle(() => ({
    opacity: titleOpacity.value,
    transform: [{ translateY: titleY.value }],
  }));
  const subtitleStyle = useAnimatedStyle(() => ({ opacity: subtitleOpacity.value }));
  const sliderStyleAnim = useAnimatedStyle(() => ({ opacity: sliderOpacity.value }));
  const closeStyleAnim = useAnimatedStyle(() => ({ opacity: closeOpacity.value }));

  const thumbStyle = useAnimatedStyle(() => ({
    transform: [
      { translateX: thumbX.value },
      { scale: thumbPulse.value },
    ],
    backgroundColor: thumbColor.value,
  }));

  // A soft progress-fill underline that tracks the thumb, tinted by current mood.
  const fillStyle = useAnimatedStyle(() => ({
    width: thumbX.value + THUMB_SIZE / 2,
    backgroundColor: thumbColor.value,
    opacity: 0.22,
  }));

  // Ripple that expands out of the thumb on mood select.
  const rippleStyle = useAnimatedStyle(() => ({
    opacity: interpolate(ripple.value, [0, 0.2, 1], [0, 0.35, 0], Extrapolation.CLAMP),
    transform: [
      { translateX: thumbX.value },
      { scale: interpolate(ripple.value, [0, 1], [1, 3.2], Extrapolation.CLAMP) },
    ],
    backgroundColor: thumbColor.value,
  }));

  if (!visible) return null;

  const textColor = palette.brown;
  const softText = 'rgba(51, 52, 49, 0.75)';
  const tertiaryText = 'rgba(51, 52, 49, 0.5)';
  const trackColor = 'rgba(51, 52, 49, 0.12)';

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
            { paddingTop: insets.top + 80, paddingBottom: insets.bottom + 40 },
          ]}
        >
          <View style={styles.topSection}>
            <Animated.View style={ensoStyle}>
              <EnsoSymbol color={textColor} size={84} />
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
                of silence
              </Text>
            </Animated.View>

            <Animated.Text
              style={[
                styles.subtitle,
                { color: softText, fontFamily: Fonts.serif },
                subtitleStyle,
              ]}
            >
              {`today, that's ${today.value} ${today.unit} of quiet`}
            </Animated.Text>
          </View>

          <Animated.View style={[styles.sliderBlock, sliderStyleAnim]}>
            <Text
              style={[
                styles.moodLabel,
                {
                  color: activeMood ? textColor : tertiaryText,
                  fontFamily: Fonts.serif,
                },
              ]}
            >
              {displayedMood}
            </Text>

            <GestureDetector gesture={sliderGesture}>
              <View style={styles.sliderTouch}>
                {/* Gradient backdrop — subtle mood spectrum behind the line */}
                <LinearGradient
                  colors={MOOD_COLORS}
                  start={{ x: 0, y: 0.5 }}
                  end={{ x: 1, y: 0.5 }}
                  style={styles.gradientHint}
                />
                {/* Neutral track line on top of gradient */}
                <View style={[styles.track, { backgroundColor: trackColor }]} />
                {/* Filled portion that follows the thumb, tinted by mood */}
                <Animated.View style={[styles.trackFill, fillStyle]} />

                {/* Ripple burst on mood confirm */}
                <Animated.View pointerEvents="none" style={[styles.ripple, rippleStyle]} />

                {/* Draggable thumb */}
                <Animated.View
                  pointerEvents="none"
                  style={[styles.thumb, thumbStyle]}
                />
              </View>
            </GestureDetector>

            {/* Mood names row */}
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

          <Animated.View style={closeStyleAnim}>
            <PillButton
              label="close"
              onPress={handleClose}
              color={textColor}
              variant="outline"
            />
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
    justifyContent: 'flex-end',
  },
  topSection: {
    alignItems: 'center',
  },
  titleBlock: {
    alignItems: 'center',
    marginTop: 36,
  },
  titleMain: {
    fontSize: 38,
    fontWeight: '500',
    letterSpacing: 0.2,
    textAlign: 'center',
  },
  titleSub: {
    fontSize: 19,
    fontWeight: '300',
    letterSpacing: 0.4,
    textAlign: 'center',
    marginTop: 4,
  },
  subtitle: {
    fontSize: 17,
    fontWeight: '300',
    letterSpacing: 0.3,
    textAlign: 'center',
    marginTop: 18,
  },
  sliderBlock: {
    alignItems: 'center',
    width: SLIDER_W + 40,
    marginTop: 40,
    marginBottom: 160,
  },
  moodLabel: {
    fontSize: 22,
    fontWeight: '300',
    letterSpacing: 0.6,
    marginBottom: 28,
    minHeight: 28,
  },
  sliderTouch: {
    width: SLIDER_W,
    height: 48,
    justifyContent: 'center',
  },
  gradientHint: {
    position: 'absolute',
    height: 6,
    width: SLIDER_W,
    top: 21,
    left: 0,
    borderRadius: 3,
    opacity: 0.22,
  },
  track: {
    height: 1,
    width: '100%',
    position: 'absolute',
    top: 23.5,
    left: 0,
  },
  trackFill: {
    position: 'absolute',
    height: 2,
    top: 23,
    left: 0,
    borderRadius: 1,
  },
  ripple: {
    position: 'absolute',
    width: THUMB_SIZE,
    height: THUMB_SIZE,
    borderRadius: THUMB_SIZE / 2,
    top: 13,
    left: 0,
  },
  thumb: {
    width: THUMB_SIZE,
    height: THUMB_SIZE,
    borderRadius: THUMB_SIZE / 2,
    position: 'absolute',
    top: 13,
    left: 0,
    shadowColor: '#000',
    shadowOpacity: 0.15,
    shadowRadius: 6,
    shadowOffset: { width: 0, height: 2 },
  },
  moodRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    width: SLIDER_W + 20,
    marginTop: 18,
    paddingHorizontal: 0,
  },
  moodRowLabel: {
    fontSize: 11,
    fontWeight: '400',
    letterSpacing: 0.3,
    textAlign: 'center',
    flex: 1,
  },
});
