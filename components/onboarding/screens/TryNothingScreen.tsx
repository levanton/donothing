import { useCallback, useEffect, useRef, useState } from 'react';
import { Image, Pressable, StyleSheet, Text, View } from 'react-native';
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

import { EASE_OUT } from '@/constants/animations';
import { cueSessionStart, cueSessionResume, cueSessionComplete } from '@/lib/session-cues';
import { track } from '@/lib/analytics';
import AnimatedTimerDisplay from '@/components/AnimatedTimerDisplay';
import GhostButton from '@/components/GhostButton';
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

// The same pause artwork the real session shows when the phone is lifted
// (SessionEndedSheet). Preloaded so the pause never flashes empty.
const pauseImage = require('@/assets/images/pause-trimmed.png');
Asset.fromModule(pauseImage).downloadAsync().catch(() => {});

interface Props {
  isActive: boolean;
  onNext: () => void;
  onSkip?: () => void;
  theme: { text: string; bg: string };
}

export default function TryNothingScreen({ isActive, onNext }: Props) {
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

  const entryOpacity = useSharedValue(0);
  const entryTranslateY = useSharedValue(12);

  const hintOpacity = useSharedValue(1);

  // The accelerometer starts the minute the phone settles face down —
  // and stays on so the finish can wait for the pick-up gesture.
  const { faceDown, available } = useFaceDown((arming || started) && isActive);

  // Lifting the phone mid-minute pauses the rehearsal (just like the real
  // session) — the clock freezes and a "put it back down" message shows
  // until the phone settles face down again. Gated on `available`: with
  // no accelerometer the session runs via the fallback button and
  // `faceDown` is permanently false, so WITHOUT this gate the run would
  // be stuck "paused" forever and never tick. No sensor → no pause.
  const paused = available && started && !finished && !faceDown;

  // Same screen-dimming behaviour as the real session timer: once started,
  // the brightness + timer fade to black; a tap anywhere then wakes it.
  // While face down the backlight drops to true zero. `suppressed` while
  // paused so the screen brightens and the pause message is readable.
  const { contentStyle, dimmed, wake } = useSessionScreen({
    active: started,
    suppressed: paused,
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

  // begin: the phone settled face down. Just flips state + the "it has
  // begun" cues — the ticking itself lives in the face-down-aware effect
  // below so a lift can pause it.
  const begin = useCallback(() => {
    setArming(false);
    setStarted(true);
    setElapsed(0);
    track('onboarding_session_started');
    // Exactly the same "it has begun" cue as the real session.
    cueSessionStart();

    hintOpacity.value = withTiming(0, { duration: 500, easing: EASE_OUT });
  }, [hintOpacity]);

  useEffect(() => {
    if (arming && faceDown) begin();
  }, [arming, faceDown, begin]);

  // Resuming after a lift — placing the phone back face down continues
  // the minute with the same resume cue (pulse + chime) the real session
  // fires. No torch flash — that marks the beginning and the end.
  const wasPausedRef = useRef(false);
  useEffect(() => {
    if (paused) {
      wasPausedRef.current = true;
      return;
    }
    if (wasPausedRef.current && started && !finished) {
      wasPausedRef.current = false;
      cueSessionResume();
    }
  }, [paused, started, finished]);

  // Guarded so the minute is only ever recorded ONCE — a side effect in a
  // state updater (the old shape) could double-fire under React 19's
  // re-invoked updaters and save two onboarding sessions.
  const completedRef = useRef(false);
  const completeMinute = useCallback(() => {
    if (completedRef.current) return;
    completedRef.current = true;
    deactivateKeepAwake(KEEP_AWAKE.ONBOARDING);
    // Persist the onboarding minute as a real session so the home screen
    // stats aren't empty on first launch. recordSession also refreshes
    // weekStats and checks milestones in one shot.
    useAppStore.getState().recordSession(SESSION_DURATION);
    track('onboarding_session_completed', { durationSec: SESSION_DURATION });
    // Same end-of-timer ritual as the real session: the special celebrate
    // vibration swell + chime + torch breathing up off the table.
    cueSessionComplete('celebrate');
    setFinished(true);
  }, []);

  // The clock ticks while the minute is running and NOT paused. With an
  // accelerometer, paused = phone lifted (gated above). Without one
  // (fallback start), `available` is false so the run ticks straight
  // through — the no-sensor path must not be held hostage by face-down.
  // The updater stays pure (just increments); completion is detected in
  // its own effect below.
  useEffect(() => {
    if (!started || finished) return;
    if (available && !faceDown) return; // sensor present + lifted = paused
    const id = setInterval(() => {
      setElapsed((prev) => Math.min(prev + 1, SESSION_DURATION));
    }, 1000);
    intervalRef.current = id;
    return () => clearInterval(id);
  }, [started, finished, faceDown, available]);

  // Completion — fires once the full minute has elapsed, exactly once.
  useEffect(() => {
    if (started && !finished && elapsed >= SESSION_DURATION) {
      completeMinute();
    }
  }, [started, finished, elapsed, completeMinute]);

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

        {/* Lifted mid-minute — the clock is frozen; tell them how to
            resume. The same pause artwork the real session shows, above
            the mono resume line. */}
        {paused && (
          <View style={styles.pausedGroup}>
            <Image source={pauseImage} style={styles.pauseIllustration} fadeDuration={0} />
            <Text style={[styles.gateTitle, { fontFamily: Fonts!.mono }]}>
              paused — place your phone{'\n'}face down to continue
            </Text>
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

      {/* No skip here on purpose: this is the first taste of the whole
          app — offering an exit at the moment of value invites the user
          out exactly when we want them in. The minute is short and the
          flip is the only ask. The ONE exception is a dead/unavailable
          accelerometer: without the sensor the flip can never start the
          minute, so a manual "tap to start" appears — only then, never
          on a timer (same rule as the real face-down gate). */}
      {!started && available === false && (
        <GhostButton
          label="can’t flip it? tap to start"
          onPress={begin}
          style={[styles.fallbackButton, { bottom: insets.bottom + 30 }]}
        />
      )}

      {/* A tap anywhere wakes the screen the whole time it's dimming or
          dark — not only once fully black — so the user can bring the
          content back mid-fade. */}
      {dimmed && (
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
    // Keep the copy off the screen edges so a long line wraps inside a
    // calm column instead of stretching the centred content full-width.
    maxWidth: 300,
  },
  gateIllustration: {
    // Trimmed artwork, ~1.4:1 — same box as the real gate.
    width: 170,
    height: 120,
    marginTop: 28,
    resizeMode: 'contain',
  },
  // Paused header — pause artwork stacked over the mono resume line.
  pausedGroup: {
    alignItems: 'center',
    gap: 18,
  },
  pauseIllustration: {
    width: 190,
    height: 150,
    resizeMode: 'contain',
  },
  footerGroup: {
    alignItems: 'center',
  },
  footer: {
    fontSize: 21,
    fontWeight: '400',
    lineHeight: 30,
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
  fallbackButton: {
    position: 'absolute',
    alignSelf: 'center',
  },
  wakeCatcher: {
    zIndex: 100,
  },
});
