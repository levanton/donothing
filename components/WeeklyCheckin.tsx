import { memo, useCallback, useEffect, useState } from 'react';
import { Pressable, StyleSheet, Text, View } from 'react-native';
import * as Haptics from 'expo-haptics';
import Animated, {
  Easing,
  FadeIn,
  FadeInDown,
  useAnimatedStyle,
  useSharedValue,
  withRepeat,
  withSequence,
  withTiming,
} from 'react-native-reanimated';

import { Fonts } from '@/constants/theme';
import type { AppTheme } from '@/lib/theme';
import { palette } from '@/lib/theme';
import type { CheckinRow } from '@/lib/db/types';
import PillButton from './PillButton';

const EASE_OUT = Easing.bezier(0.25, 0.1, 0.25, 1);

const PARAMS = [
  { key: 'sleep', label: 'sleep' },
  { key: 'anxiety', label: 'anxiety' },
  { key: 'focus', label: 'focus' },
  { key: 'energy', label: 'energy' },
] as const;

type ParamKey = (typeof PARAMS)[number]['key'];

function getComparison(
  current: number,
  previous: number | undefined,
): { text: string; type: 'up' | 'same' | 'down' } | null {
  if (previous === undefined) return null;
  if (current > previous) return { text: 'improved', type: 'up' };
  if (current < previous) return { text: 'lower', type: 'down' };
  return { text: 'same', type: 'same' };
}

interface Props {
  visible: boolean;
  theme: AppTheme;
  previousCheckin: CheckinRow | null;
  onDone: (data: { sleep: number; anxiety: number; focus: number; energy: number }) => void;
  onDismiss: () => void;
}

function WeeklyCheckin({ visible, theme, previousCheckin, onDone, onDismiss }: Props) {
  const [values, setValues] = useState<Record<ParamKey, number>>({
    sleep: 3,
    anxiety: 3,
    focus: 3,
    energy: 3,
  });

  const containerOpacity = useSharedValue(0);
  const ringScale = useSharedValue(0.8);
  const ringOpacity = useSharedValue(0);

  useEffect(() => {
    if (visible) {
      setValues({ sleep: 3, anxiety: 3, focus: 3, energy: 3 });
      containerOpacity.value = withTiming(1, { duration: 500 });

      // Soft ring appears
      ringOpacity.value = withTiming(0.08, { duration: 600 });
      ringScale.value = withTiming(1, { duration: 800, easing: EASE_OUT });

      // Breathing
      setTimeout(() => {
        ringScale.value = withRepeat(
          withSequence(
            withTiming(1.04, { duration: 4000, easing: Easing.inOut(Easing.ease) }),
            withTiming(0.96, { duration: 4000, easing: Easing.inOut(Easing.ease) }),
          ),
          -1,
          false,
        );
      }, 900);
    } else {
      containerOpacity.value = 0;
      ringOpacity.value = 0;
      ringScale.value = 0.8;
    }
  }, [visible]);

  const animatedContainer = useAnimatedStyle(() => ({
    opacity: containerOpacity.value,
    pointerEvents: containerOpacity.value > 0.5 ? 'auto' : 'none',
  }));

  const animatedRing = useAnimatedStyle(() => ({
    opacity: ringOpacity.value,
    transform: [{ scale: ringScale.value }],
  }));

  const handleDot = useCallback((key: ParamKey, val: number) => {
    Haptics.selectionAsync();
    setValues((prev) => ({ ...prev, [key]: val }));
  }, []);

  const handleDone = useCallback(() => {
    Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Medium);
    ringScale.value = withSequence(
      withTiming(1.08, { duration: 150 }),
      withTiming(1, { duration: 300 }),
    );
    containerOpacity.value = withTiming(0, { duration: 400 });
    setTimeout(() => onDone(values), 430);
  }, [values, onDone]);

  const handleSkip = useCallback(() => {
    Haptics.selectionAsync();
    containerOpacity.value = withTiming(0, { duration: 300 });
    setTimeout(onDismiss, 330);
  }, [onDismiss]);

  if (!visible) return null;

  return (
    <Animated.View
      style={[styles.overlay, { backgroundColor: theme.bg }, animatedContainer]}
    >
      {/* Background breathing ring */}
      <Animated.View
        style={[styles.ring, { borderColor: theme.accent }, animatedRing]}
      />

      <View style={styles.content}>
        <Animated.Text
          entering={FadeIn.delay(100).duration(500)}
          style={[styles.title, { color: theme.text, fontFamily: Fonts.serif }]}
        >
          weekly check-in
        </Animated.Text>

        <Animated.Text
          entering={FadeIn.delay(300).duration(400)}
          style={[styles.subtitle, { color: theme.textTertiary, fontFamily: Fonts.serif }]}
        >
          how was your week?
        </Animated.Text>

        {PARAMS.map((param, idx) => {
          const prevVal = previousCheckin
            ? (previousCheckin[param.key] as number)
            : undefined;
          const comparison = getComparison(values[param.key], prevVal);

          return (
            <Animated.View
              key={param.key}
              entering={FadeInDown.delay(500 + idx * 120)
                .duration(400)
                .easing(EASE_OUT)}
              style={styles.paramRow}
            >
              <View style={styles.paramHeader}>
                <Text
                  style={[styles.paramLabel, { color: theme.text, fontFamily: Fonts.serif }]}
                >
                  {param.label}
                </Text>
                {comparison && (
                  <Text
                    style={[
                      styles.comparison,
                      {
                        fontFamily: Fonts.serif,
                        color: comparison.type === 'up' ? theme.accent : theme.textTertiary,
                      },
                    ]}
                  >
                    {comparison.type === 'up' ? '↑ ' : comparison.type === 'down' ? '↓ ' : ''}
                    {comparison.text}
                  </Text>
                )}
              </View>

              {/* Dot bar */}
              <View style={styles.dotsRow}>
                {[1, 2, 3, 4, 5].map((val) => {
                  const active = val <= values[param.key];
                  return (
                    <Pressable
                      key={val}
                      onPress={() => handleDot(param.key, val)}
                      hitSlop={8}
                      style={styles.dotHit}
                    >
                      <View
                        style={[
                          styles.dot,
                          {
                            width: active ? 28 : 22,
                            height: active ? 28 : 22,
                            borderRadius: active ? 14 : 11,
                            backgroundColor: active ? theme.accent : 'transparent',
                            borderWidth: active ? 0 : 1.5,
                            borderColor: active ? undefined : theme.border,
                          },
                        ]}
                      />
                    </Pressable>
                  );
                })}
              </View>
            </Animated.View>
          );
        })}

        <Animated.View
          entering={FadeIn.delay(1000).duration(400)}
          style={styles.buttons}
        >
          <PillButton
            label="done"
            onPress={handleDone}
            color={theme.accent}
            outline
          />
          <Pressable onPress={handleSkip} hitSlop={20}>
            <Text
              style={[styles.skip, { color: theme.textTertiary, fontFamily: Fonts.serif }]}
            >
              skip
            </Text>
          </Pressable>
        </Animated.View>
      </View>
    </Animated.View>
  );
}

export default memo(WeeklyCheckin);

const styles = StyleSheet.create({
  overlay: {
    ...StyleSheet.absoluteFillObject,
    justifyContent: 'center',
    alignItems: 'center',
    zIndex: 105,
  },
  ring: {
    position: 'absolute',
    width: 300,
    height: 300,
    borderRadius: 150,
    borderWidth: 2,
    alignSelf: 'center',
    top: '50%',
    marginTop: -150,
  },
  content: {
    width: '100%',
    paddingHorizontal: 40,
    alignItems: 'center',
  },
  title: {
    fontSize: 24,
    fontWeight: '300',
    letterSpacing: 0.5,
    marginBottom: 8,
  },
  subtitle: {
    fontSize: 15,
    fontWeight: '300',
    fontStyle: 'italic',
    marginBottom: 40,
  },
  paramRow: {
    width: '100%',
    marginBottom: 28,
  },
  paramHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'baseline',
    marginBottom: 14,
  },
  paramLabel: {
    fontSize: 17,
    fontWeight: '400',
  },
  comparison: {
    fontSize: 12,
    fontWeight: '300',
    fontStyle: 'italic',
  },
  dotsRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 16,
  },
  dotHit: {
    padding: 2,
  },
  dot: {},
  buttons: {
    alignItems: 'center',
    marginTop: 20,
    gap: 18,
  },
  skip: {
    fontSize: 13,
    fontWeight: '300',
    fontStyle: 'italic',
  },
});
