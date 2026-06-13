import { useCallback, useEffect, useRef, useState } from 'react';
import { Pressable, StyleSheet, Text, View } from 'react-native';
import { Feather } from '@expo/vector-icons';
import { activateKeepAwakeAsync, deactivateKeepAwake } from 'expo-keep-awake';
import { KEEP_AWAKE } from '@/constants/keepAwake';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import Animated, {
  cancelAnimation,
  Easing,
  useSharedValue,
  useAnimatedStyle,
  withRepeat,
  withTiming,
  withDelay,
} from 'react-native-reanimated';
import { Asset } from 'expo-asset';
import torch from 'torch';

import { EASE_OUT } from '@/constants/animations';
import { haptics } from '@/lib/haptics';
import { sound } from '@/lib/sound';
import { track } from '@/lib/analytics';
import AnimatedTimerDisplay from '@/components/AnimatedTimerDisplay';
import PillButton from '@/components/PillButton';
import { Fonts } from '@/constants/theme';
import { palette } from '@/lib/theme';
import { useAppStore } from '@/lib/store';
import { useFaceDown } from '@/hooks/useFaceDown';
import { useSessionScreen } from '@/hooks/useSessionScreen';

const SESSION_DURATION = 60;
// Slower auto-dim than the real timer (default 5.5s) — this onboarding
// minute eases into darkness more gently.
const DIM_DURATION_MS = 15000;

// Same illustration as the real face-down gate (RunOverlay). Decode at
// module load so it's ready the first time the screen opens.
const phoneDownImage = require('@/assets/images/phone-down-7-trimmed.png');
Asset.fromModule(phoneDownImage).downloadAsync().catch(() => {});

interface Props {
  isActive: boolean;
  onNext: () => void;
  onSkip?: () => void;
  theme: { text: string; bg: string };
}

export default function TryNothingScreen({ isActive, onNext, onSkip }: Props) {
  const insets = useSafeAreaInsets();
  // arming ("place your phone face down") → running → done. No "yes" tap:
  // the rehearsal IS the face-down ritual, so the screen arms itself the
  // moment it becomes active and the user's only job is to flip the phone.
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

  const hintOpacity = useSharedValue(1);

  // The accelerometer starts the minute the phone settles face down —
  // and stays on so the finish can wait for the pick-up gesture.
  const { faceDown } = useFaceDown((arming || started) && isActive);

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

  // Arm the rehearsal the moment the screen becomes active.
  const armed = useRef(false);
  useEffect(() => {
    if (!isActive || armed.current) return;
    armed.current = true;
    track('onboarding_session_armed');
    // Keep-awake from here: the armed phone may already be face down.
    activateKeepAwakeAsync(KEEP_AWAKE.ONBOARDING);
    setArming(true);
  }, [isActive]);

  // The illustration breathes while we wait for the flip — same gentle
  // float as the real gate (RunOverlay): a 5pt drift, a whisper of opacity.
  const breath = useSharedValue(0);
  useEffect(() => {
    if (isActive && !started) {
      breath.value = withRepeat(
        withTiming(1, { duration: 3000, easing: Easing.inOut(Easing.sin) }),
        -1,
        true,
      );
      return;
    }
    cancelAnimation(breath);
    breath.value = 0;
  }, [isActive, started, breath]);
  const breathStyle = useAnimatedStyle(() => ({
    opacity: 0.74 + 0.08 * breath.value,
    transform: [{ translateY: -5 * breath.value }],
  }));

  // begin: the phone settled face down.
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
  }, [hintOpacity]);

  useEffect(() => {
    if (arming && faceDown) begin();
  }, [arming, faceDown, begin]);

  // The reveal: the user lifts the phone, the next screen greets them.
  useEffect(() => {
    if (finished && !faceDown) onNext();
  }, [finished, faceDown, onNext]);

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

  const hintStyle = useAnimatedStyle(() => ({
    opacity: hintOpacity.value,
  }));

  const remaining = SESSION_DURATION - elapsed;

  return (
    <View style={styles.container}>
      <Animated.View style={[styles.content, entryStyle]}>
        {/* Gate intro — title + illustration above the timer, centred as
            one group. Same shape and mono voice as the real face-down
            gate (RunOverlay), with the onboarding's own wording. */}
        {!started && (
          <View style={styles.gateIntro}>
            <Text style={[styles.gateTitle, { fontFamily: Fonts!.mono }]}>
              when you’re ready,{'\n'}place your phone face down
            </Text>
            <View style={styles.chimeRow}>
              <Feather name="bell" size={13} color={palette.cream} />
              <Text style={[styles.chimeText, { fontFamily: Fonts?.serif }]}>
                a gentle chime when the minute’s up
              </Text>
            </View>
            <Animated.Image
              source={phoneDownImage}
              style={[styles.gateIllustration, breathStyle]}
              fadeDuration={0}
            />
          </View>
        )}

        <Animated.View style={contentStyle}>
          <AnimatedTimerDisplay
            seconds={remaining}
            color={palette.cream}
            fontSize={76}
          />
        </Animated.View>

        {/* The vibe first — be here, do nothing — then a quiet line on
            how we'll let them know it's over. */}
        {!started && (
          <Animated.View style={[styles.footerGroup, hintStyle]} pointerEvents="none">
            <Text style={[styles.footer, { fontFamily: Fonts?.serif }]}>
              just look around. be here.
            </Text>
            <Text style={[styles.footer, styles.footerStrong, { fontFamily: Fonts?.serif }]}>
              and do nothing.
            </Text>
          </Animated.View>
        )}
      </Animated.View>

      {/* Skip — same large translucent-cream outline pill as the real
          gate's "back" button, before the minute actually runs. */}
      {!started && (
        <PillButton
          label="skip"
          onPress={handleSkip}
          outline
          size="large"
          color="rgba(249, 242, 224, 0.4)"
          style={[styles.skipButton, { bottom: insets.bottom + 30 }]}
          labelStyle={[styles.skipLabel, { fontFamily: Fonts!.serif }]}
        />
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
  content: {
    alignItems: 'center',
    gap: 28,
  },
  // Mirrors RunOverlay's gate: title + illustration centred above the
  // timer as one group.
  gateIntro: {
    alignItems: 'center',
    marginBottom: 8,
  },
  gateTitle: {
    fontSize: 18,
    fontWeight: '400',
    lineHeight: 27,
    letterSpacing: 0.5,
    color: palette.cream,
    textAlign: 'center',
  },
  gateIllustration: {
    // Trimmed artwork, ~1.4:1 — same box as the real gate.
    width: 170,
    height: 120,
    marginTop: 28,
    resizeMode: 'contain',
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
  // Quiet practical note under the vibe — a bell icon + how we signal
  // the end. Set apart from the vibe copy with a soft cream pill so it
  // reads as a system reassurance, not part of the mantra.
  chimeRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
    marginTop: 16,
    paddingVertical: 9,
    paddingHorizontal: 16,
    borderRadius: 14,
    backgroundColor: 'rgba(249, 242, 224, 0.12)',
  },
  chimeText: {
    fontSize: 15,
    fontWeight: '400',
    lineHeight: 20,
    color: palette.cream,
    textAlign: 'center',
  },
  skipButton: {
    position: 'absolute',
    alignSelf: 'center',
  },
  wakeCatcher: {
    zIndex: 100,
  },
  skipLabel: {
    color: palette.cream,
  },
});
