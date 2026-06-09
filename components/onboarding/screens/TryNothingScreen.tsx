import { useCallback, useEffect, useRef, useState } from 'react';
import { Pressable, StyleSheet, Text, View } from 'react-native';
import { Feather } from '@expo/vector-icons';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import Animated, {
  useSharedValue,
  useAnimatedStyle,
  withTiming,
  withDelay,
} from 'react-native-reanimated';
import { EASE_OUT } from '@/constants/animations';
import { haptics } from '@/lib/haptics';
import { sound } from '@/lib/sound';
import { track } from '@/lib/analytics';
import AnimatedTimerDisplay from '@/components/AnimatedTimerDisplay';
import { Fonts } from '@/constants/theme';
import { palette } from '@/lib/theme';
import { useAppStore } from '@/lib/store';
import { useSessionScreen } from '@/hooks/useSessionScreen';

const SESSION_DURATION = 60;
const YES_BUTTON_SIZE = 140;
// Slower auto-dim than the real timer (default 5.5s) — this onboarding
// minute eases into darkness more gently.
const DIM_DURATION_MS = 15000;

interface Props {
  isActive: boolean;
  onNext: () => void;
  onSkip?: () => void;
  theme: { text: string; bg: string };
}

export default function TryNothingScreen({ isActive, onNext, onSkip }: Props) {
  const insets = useSafeAreaInsets();
  const [started, setStarted] = useState(false);
  const [elapsed, setElapsed] = useState(0);
  const [distractionFree, setDistractionFree] = useState(false);
  const intervalRef = useRef<ReturnType<typeof setInterval>>(undefined);

  const toggleDistractionFree = useCallback(() => {
    haptics.light();
    setDistractionFree((v) => !v);
  }, []);

  const handleSkip = useCallback(() => {
    if (intervalRef.current) clearInterval(intervalRef.current);
    haptics.light();
    track('onboarding_session_skipped');
    (onSkip ?? onNext)();
  }, [onNext, onSkip]);

  const entryOpacity = useSharedValue(0);
  const entryTranslateY = useSharedValue(12);

  const yesOpacity = useSharedValue(1);
  const headerOpacity = useSharedValue(1);
  const hintOpacity = useSharedValue(1);

  // Same screen-dimming behaviour as the real session timer: once started,
  // the brightness + timer fade to black; a tap anywhere then wakes it. The
  // eye toggle dims instantly (distraction-free) like the real running UI.
  const { contentStyle, fullyDark, wake } = useSessionScreen({
    active: started,
    suppressed: false,
    distractionFree,
    dimDurationMs: DIM_DURATION_MS,
  });

  useEffect(() => {
    if (!isActive) return;
    entryOpacity.value = withDelay(300, withTiming(1, { duration: 700, easing: EASE_OUT }));
    entryTranslateY.value = withDelay(300, withTiming(0, { duration: 700, easing: EASE_OUT }));
  }, [isActive]);

  const startSession = useCallback(() => {
    haptics.medium();
    track('onboarding_session_started');
    setStarted(true);

    yesOpacity.value = withTiming(0, { duration: 500, easing: EASE_OUT });
    headerOpacity.value = withTiming(0, { duration: 500, easing: EASE_OUT });
    hintOpacity.value = withTiming(0, { duration: 500, easing: EASE_OUT });

    setElapsed(0);
    intervalRef.current = setInterval(() => {
      setElapsed(prev => {
        if (prev >= SESSION_DURATION - 1) {
          clearInterval(intervalRef.current);
          // Persist the onboarding minute as a real session so the home
          // screen stats aren't empty on first launch. recordSession also
          // refreshes weekStats and checks milestones in one shot.
          useAppStore.getState().recordSession(SESSION_DURATION);
          track('onboarding_session_completed', { durationSec: SESSION_DURATION });
          // Same end-of-timer feel as the real session: the Opal-style
          // haptic swell + the soft completion sound.
          haptics.celebrate();
          sound.complete();
          onNext();
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

  const entryStyle = useAnimatedStyle(() => ({
    opacity: entryOpacity.value,
    transform: [{ translateY: entryTranslateY.value }],
  }));

  const yesStyle = useAnimatedStyle(() => ({
    opacity: yesOpacity.value,
  }));

  const headerStyle = useAnimatedStyle(() => ({
    opacity: headerOpacity.value,
  }));

  const hintStyle = useAnimatedStyle(() => ({
    opacity: hintOpacity.value,
  }));

  const remaining = SESSION_DURATION - elapsed;

  return (
    <View style={styles.container}>
      <Animated.View style={[styles.content, entryStyle]}>
        <Animated.View style={headerStyle}>
          <Text style={[styles.headerText, { fontFamily: Fonts?.serif }]}>
            Ready to try nothing?
          </Text>
        </Animated.View>

        <Animated.View style={contentStyle}>
          <AnimatedTimerDisplay
            seconds={remaining}
            color={palette.cream}
            fontSize={96}
          />
        </Animated.View>

        <View style={styles.yesWrap}>
          <Animated.View style={yesStyle} pointerEvents={started ? 'none' : 'auto'}>
            <Pressable onPress={!started ? startSession : undefined}>
              <View style={styles.yesButton}>
                <Text style={[styles.yesLabel, { fontFamily: Fonts?.serif }]}>
                  yes
                </Text>
              </View>
            </Pressable>
          </Animated.View>
        </View>

        <Animated.View style={[styles.footerGroup, hintStyle]} pointerEvents="none">
          <Text style={[styles.footer, { fontFamily: Fonts?.serif }]}>
            just look around. be here.
          </Text>
          <Text style={[styles.footer, styles.footerStrong, { fontFamily: Fonts?.serif }]}>
            and do nothing.
          </Text>
        </Animated.View>
      </Animated.View>

      {/* Skip is only offered before the minute starts. */}
      {!started && (
        <Pressable
          onPress={handleSkip}
          style={[styles.skipButton, { bottom: insets.bottom + 28 }]}
          hitSlop={16}
        >
          <Text style={[styles.skipLabel, { fontFamily: Fonts?.serif }]}>skip</Text>
        </Pressable>
      )}

      {/* Eye toggle — tap to turn the screen off instantly (distraction-free),
          same as the real running UI. Fades out with the content as it dims. */}
      {started && (
        <Animated.View
          style={[styles.runHideStack, { bottom: insets.bottom + 40 }, contentStyle]}
          pointerEvents={distractionFree ? 'none' : 'box-none'}
        >
          <Pressable
            onPress={toggleDistractionFree}
            style={styles.runHideIconBtn}
            hitSlop={16}
          >
            <Feather name="eye-off" size={18} color={palette.cream} style={{ opacity: 0.78 }} />
          </Pressable>
          <Text style={[styles.runHideHint, { fontFamily: Fonts?.serif }]}>
            tap so nothing distracts
          </Text>
        </Animated.View>
      )}

      {/* In distraction-free mode a tap anywhere brings the screen back. */}
      {distractionFree && (
        <Pressable
          style={[StyleSheet.absoluteFill, styles.wakeCatcher]}
          onPress={toggleDistractionFree}
        />
      )}

      {/* Once the auto-dim has faded fully black, a tap anywhere wakes it —
          same as the real session timer. */}
      {fullyDark && !distractionFree && (
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
  runHideStack: {
    position: 'absolute',
    left: 0,
    right: 0,
    alignItems: 'center',
  },
  runHideIconBtn: {
    width: 38,
    height: 38,
    borderRadius: 19,
    borderWidth: 1,
    borderColor: 'rgba(249, 242, 224, 0.42)',
    alignItems: 'center',
    justifyContent: 'center',
  },
  runHideHint: {
    color: palette.cream,
    fontSize: 11,
    letterSpacing: 0.3,
    opacity: 0.55,
    marginTop: 8,
    textAlign: 'center',
  },
});
