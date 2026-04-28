import { memo, useEffect } from 'react';
import { Dimensions, StyleSheet } from 'react-native';
import Animated, {
  cancelAnimation,
  Easing,
  useAnimatedStyle,
  useSharedValue,
  withRepeat,
  withTiming,
} from 'react-native-reanimated';

import { palette } from '@/lib/theme';

// Tiny epsilon — t.value below this is treated as "never started"
// (the cycle hadn't crossed the initial-stagger gate yet), so we
// re-apply the stagger delay rather than resuming from "0".
const RESUME_EPSILON = 1e-4;

// Drifting warm-tone dots that float upward across the running
// screen, like dust motes in golden-hour light. Mixed colours +
// mixed sizes give the layer constellation-like variety so it never
// reads as a uniform pattern.
const SCREEN_W = Dimensions.get('window').width;
const SCREEN_H = Dimensions.get('window').height;

const DOT_DURATION = 28000;
// Dots travel the full screen — from just above the bottom edge all
// the way past the top safe-area, fading out as they leave.
const BAND_BOTTOM = SCREEN_H * 0.95;
const DRIFT_HEIGHT = BAND_BOTTOM + 40;

// Three warm earth-tones that read against terracotta without
// fighting the cream timer for attention.
const COLOR_CREAM = palette.cream;
const COLOR_SAND = palette.sand;
const COLOR_SALMON = palette.salmon;

interface DotConfig {
  startX: number;       // px from screen centre
  swayAmplitude: number;// horizontal sway range
  swayPhase: number;    // 0..1 phase offset for the sway sine
  delay: number;        // ms after mount before this dot enters
  peakOpacity: number;  // top of the fade — keeps dots faint
  size: number;         // dot diameter
  color: string;
}

// 18 dots, staggered ~1555ms apart so the layer always has a few in
// frame at the new slower 28s drift duration. Sizes 4–7px, mixed
// colours, varied sway so neighbouring dots don't look like a
// synchronized pattern.
const DOTS: DotConfig[] = [
  { startX: -SCREEN_W * 0.38, swayAmplitude: 22, swayPhase: 0.0, delay: 0,     peakOpacity: 0.36, size: 5, color: COLOR_CREAM },
  { startX: -SCREEN_W * 0.20, swayAmplitude: 30, swayPhase: 0.3, delay: 1555,  peakOpacity: 0.44, size: 4, color: COLOR_SALMON },
  { startX:  SCREEN_W * 0.04, swayAmplitude: 18, swayPhase: 0.6, delay: 3110,  peakOpacity: 0.40, size: 7, color: COLOR_SAND },
  { startX:  SCREEN_W * 0.22, swayAmplitude: 26, swayPhase: 0.1, delay: 4665,  peakOpacity: 0.32, size: 5, color: COLOR_CREAM },
  { startX: -SCREEN_W * 0.30, swayAmplitude: 28, swayPhase: 0.4, delay: 6220,  peakOpacity: 0.46, size: 6, color: COLOR_SAND },
  { startX:  SCREEN_W * 0.36, swayAmplitude: 20, swayPhase: 0.7, delay: 7775,  peakOpacity: 0.34, size: 4, color: COLOR_SALMON },
  { startX: -SCREEN_W * 0.08, swayAmplitude: 24, swayPhase: 0.2, delay: 9330,  peakOpacity: 0.42, size: 7, color: COLOR_CREAM },
  { startX: -SCREEN_W * 0.42, swayAmplitude: 16, swayPhase: 0.5, delay: 10885, peakOpacity: 0.30, size: 5, color: COLOR_SALMON },
  { startX:  SCREEN_W * 0.12, swayAmplitude: 32, swayPhase: 0.8, delay: 12440, peakOpacity: 0.40, size: 4, color: COLOR_SAND },
  { startX:  SCREEN_W * 0.42, swayAmplitude: 22, swayPhase: 0.0, delay: 13995, peakOpacity: 0.36, size: 6, color: COLOR_CREAM },
  { startX: -SCREEN_W * 0.12, swayAmplitude: 28, swayPhase: 0.55,delay: 15550, peakOpacity: 0.44, size: 7, color: COLOR_SALMON },
  { startX: -SCREEN_W * 0.26, swayAmplitude: 18, swayPhase: 0.25,delay: 17105, peakOpacity: 0.32, size: 4, color: COLOR_SAND },
  { startX:  SCREEN_W * 0.30, swayAmplitude: 26, swayPhase: 0.75,delay: 18660, peakOpacity: 0.38, size: 5, color: COLOR_CREAM },
  { startX:  SCREEN_W * 0.00, swayAmplitude: 14, swayPhase: 0.45,delay: 20215, peakOpacity: 0.40, size: 6, color: COLOR_SALMON },
  { startX: -SCREEN_W * 0.34, swayAmplitude: 24, swayPhase: 0.65,delay: 21770, peakOpacity: 0.34, size: 5, color: COLOR_SAND },
  { startX:  SCREEN_W * 0.18, swayAmplitude: 20, swayPhase: 0.15,delay: 23325, peakOpacity: 0.42, size: 7, color: COLOR_CREAM },
  { startX:  SCREEN_W * 0.06, swayAmplitude: 30, swayPhase: 0.85,delay: 24880, peakOpacity: 0.36, size: 4, color: COLOR_SALMON },
  { startX: -SCREEN_W * 0.04, swayAmplitude: 26, swayPhase: 0.35,delay: 26435, peakOpacity: 0.38, size: 6, color: COLOR_SAND },
];

interface DriftingDotProps {
  config: DotConfig;
  active: boolean;
}

const DriftingDot = memo(function DriftingDot({ config, active }: DriftingDotProps) {
  // Cycle progress 0..1 — the only animated value per dot. Position +
  // opacity are derived inside the animated style worklet.
  const t = useSharedValue(0);

  useEffect(() => {
    if (!active) {
      // Freeze in place. NO `t.value = 0` reset — that's what made
      // pausing send the dots back to the bottom of the screen.
      cancelAnimation(t);
      return;
    }
    const startCycle = () => {
      // From the current position, finish the in-flight cycle (only
      // covers the remaining 1 - t fraction at the original rate),
      // then snap back to 0 and repeat indefinitely. Without the
      // partial first leg, withRepeat would run a full DOT_DURATION
      // cycle starting from the resume point, which both stretches
      // the timing and visibly skips the dot to the top.
      const remaining = 1 - t.value;
      t.value = withTiming(
        1,
        { duration: remaining * DOT_DURATION, easing: Easing.linear },
        (finished) => {
          if (!finished) return;
          t.value = 0;
          t.value = withRepeat(
            withTiming(1, { duration: DOT_DURATION, easing: Easing.linear }),
            -1,
            false,
          );
        },
      );
    };
    // First entrance — apply the stagger so dots don't all surface
    // at once. Resume — start immediately from the frozen position.
    if (t.value > RESUME_EPSILON) {
      startCycle();
      return () => cancelAnimation(t);
    }
    const timer = setTimeout(startCycle, config.delay);
    return () => {
      clearTimeout(timer);
      cancelAnimation(t);
    };
  }, [active]);

  const dotStyle = useAnimatedStyle(() => {
    'worklet';
    const tt = t.value;
    // Vertical drift — linear from band bottom to band top.
    const dy = -tt * DRIFT_HEIGHT;
    // Horizontal sway — slow sine, two periods per cycle so the path
    // looks wandering, not just shifted.
    const dx =
      config.startX +
      Math.sin((tt + config.swayPhase) * Math.PI * 2) * config.swayAmplitude;
    // Fade in over first 12%, hold, fade out over last 18%.
    let opacity: number;
    if (tt < 0.12) opacity = (tt / 0.12) * config.peakOpacity;
    else if (tt > 0.82) opacity = ((1 - tt) / 0.18) * config.peakOpacity;
    else opacity = config.peakOpacity;
    return {
      transform: [{ translateX: dx }, { translateY: dy }],
      opacity,
    };
  });

  return (
    <Animated.View
      style={[
        styles.dot,
        {
          width: config.size,
          height: config.size,
          borderRadius: config.size / 2,
          backgroundColor: config.color,
          top: BAND_BOTTOM,
          left: SCREEN_W / 2 - config.size / 2,
        },
        dotStyle,
      ]}
    />
  );
});

interface Props {
  active: boolean;
  /** Legacy prop — kept for back-compat; per-dot colours come from
      DOTS now. */
  color?: string;
}

const DriftingDots = memo(function DriftingDots({ active }: Props) {
  return (
    <Animated.View pointerEvents="none" style={StyleSheet.absoluteFill}>
      {DOTS.map((config, i) => (
        <DriftingDot key={i} config={config} active={active} />
      ))}
    </Animated.View>
  );
});

export default DriftingDots;

const styles = StyleSheet.create({
  dot: {
    position: 'absolute',
  },
});
