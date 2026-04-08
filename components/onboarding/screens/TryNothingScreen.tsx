import { useCallback, useEffect, useRef, useState } from 'react';
import { Pressable, StyleSheet, Text, View } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import Animated, {
  Easing,
  useSharedValue,
  useAnimatedStyle,
  withTiming,
  withDelay,
} from 'react-native-reanimated';
import * as Haptics from 'expo-haptics';
import OrbitRing from '@/components/OrbitRing';
import { Fonts } from '@/constants/theme';
import { palette } from '@/lib/theme';
import { timerDisplay } from '@/lib/format';

const EASE_OUT = Easing.bezier(0.25, 0.1, 0.25, 1);
const SESSION_DURATION = 60; // 1 minute

interface Props {
  isActive: boolean;
  onNext: () => void;
  theme: { text: string; bg: string };
}

export default function TryNothingScreen({ isActive, onNext, theme }: Props) {
  const insets = useSafeAreaInsets();
  const [state, setState] = useState<'intro' | 'running' | 'done'>('intro');
  const [elapsed, setElapsed] = useState(0);
  const intervalRef = useRef<ReturnType<typeof setInterval>>(undefined);
  const dotProgress = useSharedValue(0);

  const introOpacity = useSharedValue(0);
  const introTranslateY = useSharedValue(10);
  const sessionOpacity = useSharedValue(0);

  useEffect(() => {
    if (!isActive) return;
    introOpacity.value = withDelay(300, withTiming(1, { duration: 700, easing: EASE_OUT }));
    introTranslateY.value = withDelay(300, withTiming(0, { duration: 700, easing: EASE_OUT }));
  }, [isActive]);

  const startSession = useCallback(() => {
    Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Medium);
    setState('running');
    introOpacity.value = withTiming(0, { duration: 400, easing: EASE_OUT });
    sessionOpacity.value = withDelay(500, withTiming(1, { duration: 600, easing: EASE_OUT }));

    setElapsed(0);
    intervalRef.current = setInterval(() => {
      setElapsed(prev => {
        if (prev >= SESSION_DURATION - 1) {
          clearInterval(intervalRef.current);
          Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success);
          setState('done');
          setTimeout(() => onNext(), 1500);
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

  const introStyle = useAnimatedStyle(() => ({
    opacity: introOpacity.value,
    transform: [{ translateY: introTranslateY.value }],
  }));

  const sessionStyle = useAnimatedStyle(() => ({
    opacity: sessionOpacity.value,
  }));

  const remaining = SESSION_DURATION - elapsed;

  return (
    <View style={[styles.container, { backgroundColor: theme.bg }]}>
      {/* Intro — before starting */}
      {state === 'intro' && (
        <Animated.View style={[styles.introArea, introStyle]}>
          <Text style={[styles.introTitle, { color: theme.text }]}>
            Let's try it.
          </Text>
          <Text style={[styles.introBody, { color: theme.text }]}>
            One minute of nothing.{'\n'}Just put your phone down.
          </Text>
          <Pressable
            onPress={startSession}
            style={[styles.startButton, { borderColor: palette.terracotta }]}
          >
            <Text style={[styles.startButtonText, { color: palette.terracotta }]}>
              Start
            </Text>
          </Pressable>
        </Animated.View>
      )}

      {/* Session running */}
      {(state === 'running' || state === 'done') && (
        <Animated.View style={[styles.sessionArea, sessionStyle]}>
          <OrbitRing
            color={palette.terracotta}
            faintColor={palette.salmon}
            elapsed={elapsed}
            dotProgress={dotProgress}
          />
          <Text style={[styles.timer, { color: theme.text }]}>
            {timerDisplay(remaining)}
          </Text>
          <Text style={[styles.sessionHint, { color: theme.text }]}>
            {state === 'done' ? 'Done.' : 'Breathe.'}
          </Text>
        </Animated.View>
      )}
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
  },
  introArea: {
    alignItems: 'center',
    paddingHorizontal: 32,
  },
  introTitle: {
    fontFamily: Fonts?.serif,
    fontSize: 34,
    fontWeight: '400',
    textAlign: 'center',
    marginBottom: 16,
  },
  introBody: {
    fontFamily: Fonts?.serif,
    fontSize: 18,
    fontWeight: '300',
    textAlign: 'center',
    opacity: 0.6,
    lineHeight: 26,
    marginBottom: 48,
  },
  startButton: {
    borderWidth: 1.5,
    borderRadius: 100,
    paddingVertical: 14,
    paddingHorizontal: 40,
  },
  startButtonText: {
    fontFamily: Fonts?.serif,
    fontSize: 18,
    fontWeight: '400',
  },
  sessionArea: {
    alignItems: 'center',
    gap: 24,
  },
  timer: {
    fontSize: 48,
    fontWeight: '200',
    fontVariant: ['tabular-nums'],
    letterSpacing: 2,
  },
  sessionHint: {
    fontFamily: Fonts?.serif,
    fontSize: 18,
    fontWeight: '300',
    opacity: 0.5,
  },
});
