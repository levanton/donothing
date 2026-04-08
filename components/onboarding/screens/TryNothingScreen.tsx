import { useCallback, useEffect, useRef, useState } from 'react';
import { Dimensions, Pressable, StyleSheet, View } from 'react-native';
import { Feather } from '@expo/vector-icons';
import Animated, {
  Easing,
  useSharedValue,
  useAnimatedStyle,
  withTiming,
  withDelay,
  withRepeat,
  withSequence,
  interpolate,
} from 'react-native-reanimated';
import * as Haptics from 'expo-haptics';
import OrbitRing, { RING_SIZE } from '@/components/OrbitRing';
import TimerDisplay from '@/components/TimerDisplay';
import { Fonts } from '@/constants/theme';
import { palette } from '@/lib/theme';

const EASE_OUT = Easing.bezier(0.25, 0.1, 0.25, 1);
const SESSION_DURATION = 10; // TODO: revert to 60 for production
const RING_R = 42;

const HINTS = [
  { at: 0, text: 'breathe.' },
  { at: 10, text: 'let your thoughts drift.' },
  { at: 20, text: "there\u2019s nowhere to be." },
  { at: 30, text: "you\u2019re doing great." },
  { at: 40, text: 'the world can wait.' },
  { at: 50, text: 'just be.' },
];

function getHint(elapsed: number): string {
  for (let i = HINTS.length - 1; i >= 0; i--) {
    if (elapsed >= HINTS[i].at) return HINTS[i].text;
  }
  return HINTS[0].text;
}

interface Props {
  isActive: boolean;
  onNext: () => void;
  theme: { text: string; bg: string };
}

export default function TryNothingScreen({ isActive, onNext, theme }: Props) {
  const [started, setStarted] = useState(false);
  const [elapsed, setElapsed] = useState(0);
  const [hint, setHint] = useState(HINTS[0].text);
  const intervalRef = useRef<ReturnType<typeof setInterval>>(undefined);
  const done = elapsed >= SESSION_DURATION;

  // Shared values
  const dotProgress = useSharedValue(0);
  const entryOpacity = useSharedValue(0);
  const entryTranslateY = useSharedValue(12);

  // Play button → orbit dot (like main screen)
  const buttonSize = useSharedValue(100);
  const playIconOpacity = useSharedValue(1);
  const orbitAmount = useSharedValue(0);

  // "Your minute" label
  const labelOpacity = useSharedValue(1);

  // Hint fade
  const hintOpacity = useSharedValue(0);

  // Breathing pulse on timer
  const breathePulse = useSharedValue(1);

  // Finish burst
  const burstScale = useSharedValue(0);
  const burstOpacity = useSharedValue(0);

  // Entry animation
  useEffect(() => {
    if (!isActive) return;
    entryOpacity.value = withDelay(300, withTiming(1, { duration: 700, easing: EASE_OUT }));
    entryTranslateY.value = withDelay(300, withTiming(0, { duration: 700, easing: EASE_OUT }));
  }, [isActive]);

  // Hint text changes with fade
  const prevHintRef = useRef(HINTS[0].text);
  useEffect(() => {
    const newHint = getHint(elapsed);
    if (newHint !== prevHintRef.current) {
      prevHintRef.current = newHint;
      hintOpacity.value = withTiming(0, { duration: 300, easing: EASE_OUT });
      setTimeout(() => {
        setHint(newHint);
        hintOpacity.value = withTiming(1, { duration: 500, easing: EASE_OUT });
      }, 320);
    }
  }, [elapsed]);

  // Start: shrink button to dot, start orbiting
  const startSession = useCallback(() => {
    Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Medium);
    setStarted(true);

    // Fade out label
    labelOpacity.value = withTiming(0, { duration: 400, easing: EASE_OUT });

    // Animate button → dot
    buttonSize.value = withTiming(12, { duration: 600 });
    playIconOpacity.value = withTiming(0, { duration: 300 });
    orbitAmount.value = withTiming(1, { duration: 600 });

    // Show hint
    hintOpacity.value = withDelay(400, withTiming(1, { duration: 600, easing: EASE_OUT }));

    // Breathing pulse
    breathePulse.value = withRepeat(
      withSequence(
        withTiming(1.03, { duration: 3000, easing: Easing.inOut(Easing.ease) }),
        withTiming(1, { duration: 3000, easing: Easing.inOut(Easing.ease) }),
      ),
      -1,
      false,
    );

    setElapsed(0);
    intervalRef.current = setInterval(() => {
      setElapsed(prev => {
        if (prev >= SESSION_DURATION - 1) {
          clearInterval(intervalRef.current);
          // Gentle celebration haptic — light taps building up
          Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
          setTimeout(() => Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light), 150);
          setTimeout(() => Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Medium), 300);
          setTimeout(() => Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Medium), 450);
          setTimeout(() => Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Heavy), 650);
          setTimeout(() => Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Heavy), 850);
          setTimeout(() => Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success), 1100);
          // Burst animation
          burstOpacity.value = withTiming(1, { duration: 300 });
          burstScale.value = withTiming(1, { duration: 700, easing: Easing.out(Easing.ease) });
          setTimeout(() => onNext(), 1200);
          return SESSION_DURATION;
        }
        return prev + 1;
      });
    }, 1000);
  }, [onNext]);

  useEffect(() => {
    return () => {
      if (intervalRef.current) clearInterval(intervalRef.current);
    };
  }, []);

  // Animated styles
  const entryStyle = useAnimatedStyle(() => ({
    opacity: entryOpacity.value,
    transform: [{ translateY: entryTranslateY.value }],
  }));

  const unifiedDotStyle = useAnimatedStyle(() => {
    const rad = dotProgress.value * 2 * Math.PI;
    const orbitX = Math.sin(rad) * RING_R;
    const orbitY = -Math.cos(rad) * RING_R;
    const s = buttonSize.value;
    return {
      width: s,
      height: s,
      borderRadius: s / 2,
      transform: [
        { translateX: orbitAmount.value * orbitX },
        { translateY: orbitAmount.value * orbitY },
      ],
    };
  });

  const labelStyle = useAnimatedStyle(() => ({
    opacity: labelOpacity.value * 0.8,
  }));

  const hintStyle = useAnimatedStyle(() => ({
    opacity: interpolate(hintOpacity.value, [0, 1], [0, 0.5]),
  }));

  const pulseStyle = useAnimatedStyle(() => ({
    transform: [{ scale: breathePulse.value }],
  }));

  const { width, height } = Dimensions.get('window');
  const burstSize = Math.hypot(width, height);

  const burstStyle = useAnimatedStyle(() => ({
    opacity: burstOpacity.value,
    transform: [{ scale: burstScale.value }],
  }));

  const remaining = SESSION_DURATION - elapsed;

  return (
    <View style={[styles.container, { backgroundColor: theme.bg }]}>
      <Animated.View style={[styles.content, entryStyle]}>
        {/* Label */}
        <Animated.Text style={[styles.label, { color: theme.text }, labelStyle]}>
          your minute
        </Animated.Text>

        {/* Timer */}
        <Animated.View style={pulseStyle}>
          <TimerDisplay
            seconds={remaining}
            color={theme.text}
            fontSize={64}
          />
        </Animated.View>

        {/* Orbit ring + play button / dot */}
        <View style={styles.orbitWrap}>
          <View style={styles.orbitArea}>
            <View style={styles.orbitCenter}>
              <OrbitRing
                color={palette.terracotta}
                faintColor={palette.salmon}
                elapsed={elapsed}
                dotProgress={dotProgress}
                hideStop
              />
            </View>
            {/* Play button ↔ orbit dot */}
            <Pressable
              onPress={!started ? startSession : undefined}
              style={styles.orbitCenter}
            >
              <Animated.View
                style={[
                  { backgroundColor: palette.terracotta, justifyContent: 'center', alignItems: 'center' },
                  unifiedDotStyle,
                ]}
              >
                <Animated.View style={{ opacity: playIconOpacity }}>
                  <Feather name="play" size={36} color={theme.bg} style={{ marginLeft: 4 }} />
                </Animated.View>
              </Animated.View>
            </Pressable>
          </View>
        </View>

        {/* Hint message */}
        <Animated.Text style={[styles.hint, { color: theme.text }, hintStyle]}>
          {done ? 'done.' : hint}
        </Animated.Text>
      </Animated.View>

      {/* Finish burst */}
      <View style={styles.burstWrap}>
        <Animated.View
          style={[
            { width: burstSize, height: burstSize, borderRadius: burstSize / 2, backgroundColor: palette.terracotta },
            burstStyle,
          ]}
        />
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
  },
  content: {
    alignItems: 'center',
    gap: 28,
  },
  orbitWrap: {
    marginTop: 4,
  },
  orbitArea: {
    width: RING_SIZE,
    height: RING_SIZE,
    justifyContent: 'center',
    alignItems: 'center',
  },
  orbitCenter: {
    position: 'absolute',
    justifyContent: 'center',
    alignItems: 'center',
  },
  label: {
    fontFamily: Fonts?.serif,
    fontSize: 18,
    fontWeight: '300',
    marginBottom: -16,
  },
  hint: {
    fontFamily: Fonts?.serif,
    fontSize: 18,
    fontWeight: '300',
  },
  burstWrap: {
    ...StyleSheet.absoluteFillObject,
    justifyContent: 'center',
    alignItems: 'center',
    pointerEvents: 'none',
  },
});
