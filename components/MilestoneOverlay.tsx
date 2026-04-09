import { memo, useCallback, useEffect, useRef } from 'react';
import { Pressable, StyleSheet, View } from 'react-native';
import * as Haptics from 'expo-haptics';
import Animated, {
  Easing,
  FadeIn,
  useAnimatedStyle,
  useSharedValue,
  withDelay,
  withSequence,
  withTiming,
} from 'react-native-reanimated';

import { Fonts } from '@/constants/theme';
import type { AppTheme } from '@/lib/theme';
import { palette } from '@/lib/theme';
import type { MilestoneDef } from '@/lib/milestones';

const EASE_OUT = Easing.bezier(0.25, 0.1, 0.25, 1);

interface Props {
  milestone: MilestoneDef | null;
  theme: AppTheme;
  onDismiss: () => void;
}

function MilestoneOverlay({ milestone, theme, onDismiss }: Props) {
  const bgOpacity = useSharedValue(0);
  const burstScale = useSharedValue(0);
  const burstOpacity = useSharedValue(0);
  const titleOpacity = useSharedValue(0);
  const titleTranslateY = useSharedValue(12);
  const descOpacity = useSharedValue(0);
  const timerRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  useEffect(() => {
    if (milestone) {
      // Terracotta burst circle expands from center
      burstOpacity.value = withTiming(0.12, { duration: 300 });
      burstScale.value = withTiming(1, { duration: 700, easing: Easing.out(Easing.ease) });

      // Background fades in
      bgOpacity.value = withTiming(1, { duration: 500 });

      // Title slides up
      titleOpacity.value = withDelay(400, withTiming(1, { duration: 600, easing: EASE_OUT }));
      titleTranslateY.value = withDelay(400, withTiming(0, { duration: 600, easing: EASE_OUT }));

      // Description fades in
      descOpacity.value = withDelay(800, withTiming(1, { duration: 500 }));

      // Haptic crescendo (like FirstMinuteDone)
      setTimeout(() => Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light), 200);
      setTimeout(() => Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light), 400);
      setTimeout(() => Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Medium), 600);
      setTimeout(() => Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success), 900);

      timerRef.current = setTimeout(handleDismiss, 4500);
    } else {
      bgOpacity.value = 0;
      burstScale.value = 0;
      burstOpacity.value = 0;
      titleOpacity.value = 0;
      titleTranslateY.value = 12;
      descOpacity.value = 0;
    }
    return () => {
      if (timerRef.current) clearTimeout(timerRef.current);
    };
  }, [milestone, onDismiss]);

  const handleDismiss = useCallback(() => {
    if (timerRef.current) clearTimeout(timerRef.current);
    bgOpacity.value = withTiming(0, { duration: 400 });
    burstOpacity.value = withTiming(0, { duration: 300 });
    titleOpacity.value = withTiming(0, { duration: 300 });
    descOpacity.value = withTiming(0, { duration: 200 });
    setTimeout(onDismiss, 430);
  }, [onDismiss]);

  const animatedBg = useAnimatedStyle(() => ({
    opacity: bgOpacity.value,
    pointerEvents: bgOpacity.value > 0.5 ? 'auto' : 'none',
  }));

  const animatedBurst = useAnimatedStyle(() => ({
    opacity: burstOpacity.value,
    transform: [{ scale: burstScale.value }],
  }));

  const animatedTitle = useAnimatedStyle(() => ({
    opacity: titleOpacity.value,
    transform: [{ translateY: titleTranslateY.value }],
  }));

  const animatedDesc = useAnimatedStyle(() => ({
    opacity: descOpacity.value,
  }));

  if (!milestone) return null;

  return (
    <Animated.View style={[styles.overlay, { backgroundColor: theme.bg }, animatedBg]}>
      {/* Expanding terracotta circle */}
      <Animated.View
        style={[
          styles.burst,
          { backgroundColor: palette.terracotta },
          animatedBurst,
        ]}
      />

      <Pressable style={styles.pressable} onPress={handleDismiss}>
        <View style={styles.textContainer}>
          <Animated.Text
            style={[
              styles.title,
              { color: theme.accent, fontFamily: Fonts.serif },
              animatedTitle,
            ]}
          >
            {milestone.title}
          </Animated.Text>

          <Animated.Text
            style={[
              styles.description,
              { color: theme.textSecondary, fontFamily: Fonts.serif },
              animatedDesc,
            ]}
          >
            {milestone.description}
          </Animated.Text>
        </View>

        <Animated.Text
          entering={FadeIn.delay(1200).duration(500)}
          style={[
            styles.continueText,
            { color: theme.textTertiary, fontFamily: Fonts.serif },
          ]}
        >
          tap to continue
        </Animated.Text>
      </Pressable>
    </Animated.View>
  );
}

export default memo(MilestoneOverlay);

const styles = StyleSheet.create({
  overlay: {
    ...StyleSheet.absoluteFillObject,
    zIndex: 110,
  },
  burst: {
    position: 'absolute',
    width: 500,
    height: 500,
    borderRadius: 250,
    alignSelf: 'center',
    top: '50%',
    marginTop: -250,
  },
  pressable: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
    paddingHorizontal: 40,
  },
  textContainer: {
    alignItems: 'center',
  },
  title: {
    fontSize: 34,
    fontWeight: '300',
    fontStyle: 'italic',
    letterSpacing: 0.5,
    marginBottom: 14,
    textAlign: 'center',
  },
  description: {
    fontSize: 17,
    fontWeight: '300',
    fontStyle: 'italic',
    textAlign: 'center',
    lineHeight: 26,
  },
  continueText: {
    fontSize: 13,
    fontWeight: '300',
    fontStyle: 'italic',
    position: 'absolute',
    bottom: 80,
  },
});
