import { useCallback, useEffect, useRef, useState } from 'react';
import { Dimensions, Pressable, StyleSheet, Text, View } from 'react-native';
import Animated, {
  Easing,
  useSharedValue,
  useAnimatedStyle,
  withTiming,
  withDelay,
  withRepeat,
  withSequence,
} from 'react-native-reanimated';
import { EASE_OUT } from '@/constants/animations';
import { haptics } from '@/lib/haptics';
import AnimatedTimerDisplay from '@/components/AnimatedTimerDisplay';
import { Fonts } from '@/constants/theme';
import { palette } from '@/lib/theme';

const SESSION_DURATION = 60;
const YES_BUTTON_SIZE = 140;

interface Props {
  isActive: boolean;
  onNext: () => void;
  theme: { text: string; bg: string };
}

export default function TryNothingScreen({ isActive, onNext }: Props) {
  const [started, setStarted] = useState(false);
  const [elapsed, setElapsed] = useState(0);
  const intervalRef = useRef<ReturnType<typeof setInterval>>(undefined);

  const entryOpacity = useSharedValue(0);
  const entryTranslateY = useSharedValue(12);

  const yesOpacity = useSharedValue(1);
  const breathePulse = useSharedValue(1);

  const burstScale = useSharedValue(0);
  const burstOpacity = useSharedValue(0);

  useEffect(() => {
    if (!isActive) return;
    entryOpacity.value = withDelay(300, withTiming(1, { duration: 700, easing: EASE_OUT }));
    entryTranslateY.value = withDelay(300, withTiming(0, { duration: 700, easing: EASE_OUT }));
  }, [isActive]);

  const startSession = useCallback(() => {
    haptics.medium();
    setStarted(true);

    yesOpacity.value = withTiming(0, { duration: 500, easing: EASE_OUT });

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
          haptics.light();
          setTimeout(() => haptics.light(), 150);
          setTimeout(() => haptics.medium(), 300);
          setTimeout(() => haptics.medium(), 450);
          setTimeout(() => haptics.heavy(), 650);
          setTimeout(() => haptics.heavy(), 850);
          setTimeout(() => haptics.success(), 1100);
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

  const entryStyle = useAnimatedStyle(() => ({
    opacity: entryOpacity.value,
    transform: [{ translateY: entryTranslateY.value }],
  }));

  const pulseStyle = useAnimatedStyle(() => ({
    transform: [{ scale: breathePulse.value }],
  }));

  const yesStyle = useAnimatedStyle(() => ({
    opacity: yesOpacity.value,
  }));

  const { width, height } = Dimensions.get('window');
  const burstSize = Math.hypot(width, height);

  const burstStyle = useAnimatedStyle(() => ({
    opacity: burstOpacity.value,
    transform: [{ scale: burstScale.value }],
  }));

  const remaining = SESSION_DURATION - elapsed;

  return (
    <View style={styles.container}>
      <Animated.View style={[styles.content, entryStyle]}>
        <Animated.View style={pulseStyle}>
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
      </Animated.View>

      <View style={styles.burstWrap}>
        <Animated.View
          style={[
            { width: burstSize, height: burstSize, borderRadius: burstSize / 2, backgroundColor: palette.cream },
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
    backgroundColor: palette.terracotta,
  },
  content: {
    alignItems: 'center',
    gap: 36,
  },
  yesWrap: {
    width: YES_BUTTON_SIZE,
    height: YES_BUTTON_SIZE,
    alignItems: 'center',
    justifyContent: 'center',
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
  burstWrap: {
    ...StyleSheet.absoluteFillObject,
    justifyContent: 'center',
    alignItems: 'center',
    pointerEvents: 'none',
  },
});
