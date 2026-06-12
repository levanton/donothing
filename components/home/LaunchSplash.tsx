import { useEffect, useState } from 'react';
import { StyleSheet, Text, type ViewStyle } from 'react-native';
import Animated, {
  Easing,
  runOnJS,
  useAnimatedStyle,
  useSharedValue,
  withDelay,
  withTiming,
  type AnimatedStyle,
  type SharedValue,
} from 'react-native-reanimated';

import { Fonts } from '@/constants/theme';
import type { MeasuredRect } from '@/hooks/useMeasureRect';
import type { AppTheme } from '@/lib/theme';
import { YES_BUTTON_SIZE } from './constants';

interface LaunchSplashProps {
  ready: boolean;
  /** Measured yes-button rect — the splash waits for it so the shrink
   *  lands exactly on the button with no visible handoff. */
  yesBtnRect: MeasuredRect | null;
  theme: AppTheme;
  /** The home pane's slide transform — the splash rides it so a swipe
   *  to settings/history during the splash carries the circle off-
   *  screen instead of leaving it pinned at the visual centre. */
  slideStyle: AnimatedStyle<ViewStyle>;
  /** Splash anchor + cover size — owned by HomeShell because the run
   *  camera shares the same geometry (both land on the yes button). */
  centerX: SharedValue<number>;
  centerY: SharedValue<number>;
  initialSize: SharedValue<number>;
}

/**
 * Launch splash — terracotta fills the screen, then shrinks in place
 * onto the yes button. Animates real width/height (not scale) so the
 * edge stays crisp, and lands exactly on the measured yes-button position
 * so the splash literally becomes the button with no visible handoff.
 * Renders null once the shrink has finished.
 */
export default function LaunchSplash({
  ready,
  yesBtnRect,
  theme,
  slideStyle,
  centerX,
  centerY,
  initialSize,
}: LaunchSplashProps) {
  const [done, setDone] = useState(false);
  const progress = useSharedValue(0);

  useEffect(() => {
    if (!ready || done || !yesBtnRect) return;
    progress.value = withDelay(
      200,
      withTiming(
        1,
        { duration: 1200, easing: Easing.bezier(0.16, 1, 0.3, 1) },
        (finished) => {
          if (finished) runOnJS(setDone)(true);
        },
      ),
    );
  }, [ready, done, yesBtnRect]);

  const circleStyle = useAnimatedStyle(() => {
    const size =
      initialSize.value + progress.value * (YES_BUTTON_SIZE - initialSize.value);
    return {
      width: size,
      height: size,
      borderRadius: size / 2,
      left: centerX.value - size / 2,
      top: centerY.value - size / 2,
    };
  });

  // The inline yes label stays visible only when the splash is small enough
  // to actually read as the button — fades in over the tail of the anim.
  const labelStyle = useAnimatedStyle(() => ({
    opacity: Math.max(0, Math.min(1, (progress.value - 0.6) / 0.3)),
  }));

  if (done) return null;

  return (
    <Animated.View
      pointerEvents="none"
      style={[StyleSheet.absoluteFill, slideStyle]}
    >
      <Animated.View
        pointerEvents="none"
        style={[
          styles.splashCircle,
          { backgroundColor: theme.accent },
          circleStyle,
        ]}
      >
        <Animated.View style={[labelStyle, styles.splashLabelWrap]}>
          <Text
            style={[
              styles.splashLabel,
              { color: theme.accentText, fontFamily: Fonts!.serif },
            ]}
          >
            yes
          </Text>
        </Animated.View>
      </Animated.View>
    </Animated.View>
  );
}

const styles = StyleSheet.create({
  splashCircle: {
    position: 'absolute',
    alignItems: 'center',
    justifyContent: 'center',
    zIndex: 500,
    overflow: 'hidden',
  },
  splashLabelWrap: {
    alignItems: 'center',
    justifyContent: 'center',
  },
  splashLabel: {
    fontSize: 22,
    fontWeight: '400',
    letterSpacing: 0.5,
  },
});
