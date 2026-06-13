import { useCallback, useEffect, useRef, useState } from 'react';
import { Pressable, StyleSheet, Text, View } from 'react-native';
import { activateKeepAwakeAsync, deactivateKeepAwake } from 'expo-keep-awake';
import { KEEP_AWAKE } from '@/constants/keepAwake';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import Animated, {
  FadeIn,
  useSharedValue,
  useAnimatedStyle,
  withTiming,
  withDelay,
} from 'react-native-reanimated';
import torch from 'torch';

import { EASE_OUT } from '@/constants/animations';
import { haptics } from '@/lib/haptics';
import { sound } from '@/lib/sound';
import { track } from '@/lib/analytics';
import AnimatedTimerDisplay from '@/components/AnimatedTimerDisplay';
import { Fonts } from '@/constants/theme';
import { palette } from '@/lib/theme';
import { useAppStore } from '@/lib/store';
import { useFaceDown } from '@/hooks/useFaceDown';
import { useSessionScreen } from '@/hooks/useSessionScreen';

const SESSION_DURATION = 60;
const YES_BUTTON_SIZE = 140;
// Slower auto-dim than the real timer (default 5.5s) — this onboarding
// minute eases into darkness more gently.
const DIM_DURATION_MS = 15000;
// Manual escape hatch if the face-down sensor never triggers.
const FALLBACK_AFTER_MS = 7000;

interface Props {
  isActive: boolean;
  onNext: () => void;
  onSkip?: () => void;
  theme: { text: string; bg: string };
}

export default function TryNothingScreen({ isActive, onNext, onSkip }: Props) {
  const insets = useSafeAreaInsets();
  // idle → (yes) → arming ("put me face down") → running → done.
  const [arming, setArming] = useState(false);
  const [started, setStarted] = useState(false);
  // The minute is over but the phone still lies face down — the next
  // screen waits until the user picks it up.
  const [finished, setFinished] = useState(false);
  const [elapsed, setElapsed] = useState(0);
  const intervalRef = useRef<ReturnType<typeof setInterval>>(undefined);

  const handleSkip = useCallback(() => {
    if (intervalRef.current) clearInterval(intervalRef.current);
    haptics.light();
    track('onboarding_session_skipped');
    (onSkip ?? onNext)();
  }, [onNext, onSkip]);

  const entryOpacity = useSharedValue(0);
  const entryTranslateY = useSharedValue(12);

  const yesOpacity = useSharedValue(1);
  const hintOpacity = useSharedValue(1);

  // The accelerometer starts the minute the phone settles face down —
  // and stays on so the finish can wait for the pick-up gesture.
  const { faceDown, available } = useFaceDown((arming || started) && isActive);

  // Same screen-dimming behaviour as the real session timer: once started,
  // the brightness + timer fade to black; a tap anywhere then wakes it.
  // While face down the backlight drops to true zero.
  const { contentStyle, fullyDark, wake } = useSessionScreen({
    active: started,
    suppressed: false,
    faceDown,
    dimDurationMs: DIM_DURATION_MS,
  });

  useEffect(() => {
    if (!isActive) return;
    entryOpacity.value = withDelay(300, withTiming(1, { duration: 700, easing: EASE_OUT }));
    entryTranslateY.value = withDelay(300, withTiming(0, { duration: 700, easing: EASE_OUT }));
  }, [isActive]);

  // Step 1 — arm: the user said yes, now teach the ritual.
  const arm = useCallback(() => {
    haptics.medium();
    track('onboarding_session_armed');
    // Keep-awake from here: the armed phone may already be face down.
    activateKeepAwakeAsync(KEEP_AWAKE.ONBOARDING);
    setArming(true);
    yesOpacity.value = withTiming(0, { duration: 500, easing: EASE_OUT });
  }, []);

  // Step 2 — begin: the phone settled face down (or manual fallback).
  const begin = useCallback(() => {
    setArming(false);
    setStarted(true);
    track('onboarding_session_started');
    // Same "it has begun" as the real session — felt through the table,
    // heard even on silent.
    haptics.begin();
    sound.start();

    hintOpacity.value = withTiming(0, { duration: 500, easing: EASE_OUT });

    setElapsed(0);
    intervalRef.current = setInterval(() => {
      setElapsed(prev => {
        if (prev >= SESSION_DURATION - 1) {
          clearInterval(intervalRef.current);
          deactivateKeepAwake(KEEP_AWAKE.ONBOARDING);
          // Persist the onboarding minute as a real session so the home
          // screen stats aren't empty on first launch. recordSession also
          // refreshes weekStats and checks milestones in one shot.
          useAppStore.getState().recordSession(SESSION_DURATION);
          track('onboarding_session_completed', { durationSec: SESSION_DURATION });
          // Same end-of-timer ritual as the real session: the Opal-style
          // haptic swell + the soft chime + the torch breathing light up
          // off the table.
          haptics.celebrate();
          sound.complete();
          void torch.blink();
          setFinished(true);
          return SESSION_DURATION;
        }
        return prev + 1;
      });
    }, 1000);
  }, [onNext]);

  useEffect(() => {
    if (arming && faceDown) begin();
  }, [arming, faceDown, begin]);

  // The reveal: the user lifts the phone, the next screen greets them.
  // (A fallback-started session was never face down — advances at once.)
  useEffect(() => {
    if (finished && !faceDown) onNext();
  }, [finished, faceDown, onNext]);

  // Never strand anyone: manual start appears if the sensor stays quiet.
  const [fallbackVisible, setFallbackVisible] = useState(false);
  useEffect(() => {
    if (!arming) {
      setFallbackVisible(false);
      return;
    }
    if (!available) {
      setFallbackVisible(true);
      return;
    }
    const t = setTimeout(() => setFallbackVisible(true), FALLBACK_AFTER_MS);
    return () => clearTimeout(t);
  }, [arming, available]);

  useEffect(() => {
    return () => {
      if (intervalRef.current) clearInterval(intervalRef.current);
      deactivateKeepAwake(KEEP_AWAKE.ONBOARDING);
    };
  }, []);

  const entryStyle = useAnimatedStyle(() => ({
    opacity: entryOpacity.value,
    transform: [{ translateY: entryTranslateY.value }],
  }));

  const yesStyle = useAnimatedStyle(() => ({
    opacity: yesOpacity.value,
  }));

  const hintStyle = useAnimatedStyle(() => ({
    opacity: hintOpacity.value,
  }));

  const remaining = SESSION_DURATION - elapsed;

  return (
    <View style={styles.container}>
      <Animated.View style={[styles.content, entryStyle]}>
        {/* Header: the question, then the ritual instruction. Gone once
            the minute is running. */}
        {!started && (
          <Text style={[styles.headerText, { fontFamily: Fonts?.serif }]}>
            {arming ? 'place your phone face down' : 'Ready to try nothing?'}
          </Text>
        )}

        <Animated.View style={contentStyle}>
          <AnimatedTimerDisplay
            seconds={remaining}
            color={palette.cream}
            fontSize={96}
          />
        </Animated.View>

        <View style={styles.yesWrap}>
          {!arming && (
            <Animated.View style={yesStyle} pointerEvents={started ? 'none' : 'auto'}>
              <Pressable onPress={!started && !arming ? arm : undefined}>
                <View style={styles.yesButton}>
                  <Text style={[styles.yesLabel, { fontFamily: Fonts?.serif }]}>
                    yes
                  </Text>
                </View>
              </Pressable>
            </Animated.View>
          )}
          {arming && fallbackVisible && (
            <Animated.View entering={FadeIn.duration(500)}>
              <Pressable
                onPress={begin}
                hitSlop={12}
                accessibilityRole="button"
                accessibilityLabel="Start without flipping"
                style={styles.fallbackBtn}
              >
                <Text style={[styles.fallbackText, { fontFamily: Fonts?.serif }]}>
                  can’t flip it? tap to start
                </Text>
              </Pressable>
            </Animated.View>
          )}
        </View>

        <Animated.View style={[styles.footerGroup, hintStyle]} pointerEvents="none">
          {arming ? (
            <Text style={[styles.footer, { fontFamily: Fonts?.serif }]}>
              you’ll hear a chime when it’s done — even on silent.
            </Text>
          ) : (
            <>
              <Text style={[styles.footer, { fontFamily: Fonts?.serif }]}>
                just look around. be here.
              </Text>
              <Text style={[styles.footer, styles.footerStrong, { fontFamily: Fonts?.serif }]}>
                and do nothing.
              </Text>
            </>
          )}
        </Animated.View>
      </Animated.View>

      {/* Skip is offered any time before the minute actually runs. */}
      {!started && (
        <Pressable
          onPress={handleSkip}
          style={[styles.skipButton, { bottom: insets.bottom + 28 }]}
          hitSlop={16}
        >
          <Text style={[styles.skipLabel, { fontFamily: Fonts?.serif }]}>skip</Text>
        </Pressable>
      )}

      {/* Once the auto-dim has faded fully black, a tap anywhere wakes it —
          same as the real session timer. */}
      {fullyDark && (
        <Pressable
          style={[StyleSheet.absoluteFill, styles.wakeCatcher]}
          onPress={wake}
        />
      )}
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
    backgroundColor: palette.terracotta,
  },
  headerText: {
    fontSize: 22,
    lineHeight: 28,
    letterSpacing: 1,
    fontWeight: '400',
    color: palette.cream,
    textAlign: 'center',
  },
  content: {
    alignItems: 'center',
    gap: 28,
  },
  yesWrap: {
    width: YES_BUTTON_SIZE,
    height: YES_BUTTON_SIZE,
    alignItems: 'center',
    justifyContent: 'center',
  },
  footerGroup: {
    alignItems: 'center',
  },
  footer: {
    fontSize: 18,
    fontWeight: '400',
    lineHeight: 26,
    color: palette.cream,
    textAlign: 'center',
  },
  footerStrong: {
    fontWeight: '600',
  },
  yesButton: {
    width: YES_BUTTON_SIZE,
    height: YES_BUTTON_SIZE,
    borderRadius: YES_BUTTON_SIZE / 2,
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: palette.cream,
    overflow: 'hidden',
  },
  yesLabel: {
    fontSize: 22,
    fontWeight: '400',
    letterSpacing: 0.5,
    color: palette.terracotta,
  },
  fallbackBtn: {
    borderWidth: 1.5,
    borderColor: palette.cream,
    borderRadius: 100,
    paddingVertical: 10,
    paddingHorizontal: 22,
  },
  fallbackText: {
    fontSize: 15,
    color: palette.cream,
  },
  skipButton: {
    position: 'absolute',
    alignSelf: 'center',
    paddingVertical: 8,
    paddingHorizontal: 16,
  },
  wakeCatcher: {
    zIndex: 100,
  },
  skipLabel: {
    fontSize: 16,
    fontWeight: '400',
    letterSpacing: 0.5,
    color: palette.cream,
  },
});
