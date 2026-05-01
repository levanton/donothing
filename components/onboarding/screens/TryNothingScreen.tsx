import { useCallback, useEffect, useRef, useState } from 'react';
import { Pressable, StyleSheet, Text, View } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import Animated, {
  useSharedValue,
  useAnimatedStyle,
  withTiming,
  withDelay,
} from 'react-native-reanimated';
import { EASE_OUT } from '@/constants/animations';
import { haptics } from '@/lib/haptics';
import AnimatedTimerDisplay from '@/components/AnimatedTimerDisplay';
import { Fonts } from '@/constants/theme';
import { palette } from '@/lib/theme';
import { useAppStore } from '@/lib/store';

const SESSION_DURATION = 60;
const YES_BUTTON_SIZE = 140;

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
  const intervalRef = useRef<ReturnType<typeof setInterval>>(undefined);

  const handleSkip = useCallback(() => {
    if (intervalRef.current) clearInterval(intervalRef.current);
    haptics.light();
    (onSkip ?? onNext)();
  }, [onNext, onSkip]);

  const entryOpacity = useSharedValue(0);
  const entryTranslateY = useSharedValue(12);

  const yesOpacity = useSharedValue(1);
  const headerOpacity = useSharedValue(1);
  const hintOpacity = useSharedValue(1);

  useEffect(() => {
    if (!isActive) return;
    entryOpacity.value = withDelay(300, withTiming(1, { duration: 700, easing: EASE_OUT }));
    entryTranslateY.value = withDelay(300, withTiming(0, { duration: 700, easing: EASE_OUT }));
  }, [isActive]);

  const startSession = useCallback(() => {
    haptics.medium();
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
          haptics.success();
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
            Ready to Do nothing?
          </Text>
        </Animated.View>

        <AnimatedTimerDisplay
          seconds={remaining}
          color={palette.cream}
          fontSize={96}
        />

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

        <Animated.View style={hintStyle} pointerEvents="none">
          <Text style={[styles.hintText, { fontFamily: Fonts?.serif }]}>
            that's all you have to do.
          </Text>
        </Animated.View>
      </Animated.View>

      <Pressable
        onPress={handleSkip}
        style={[styles.skipButton, { bottom: insets.bottom + 28 }]}
        hitSlop={16}
      >
        <Text style={[styles.skipLabel, { fontFamily: Fonts?.serif }]}>skip</Text>
      </Pressable>
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
  hintText: {
    fontSize: 17,
    fontWeight: '400',
    letterSpacing: 0.3,
    color: palette.cream,
    textAlign: 'center',
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
  skipLabel: {
    fontSize: 16,
    fontWeight: '400',
    letterSpacing: 0.5,
    color: palette.cream,
  },
});
