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

// Drifting warm-tone dots that float upward across the running
// screen, like dust motes in golden-hour light. Mixed colours +
// mixed sizes give the layer constellation-like variety so it never
// reads as a uniform pattern.
const SCREEN_W = Dimensions.get('window').width;
const SCREEN_H = Dimensions.get('window').height;

const DOT_DURATION = 16000;
const DRIFT_HEIGHT = SCREEN_H * 0.78;
// Vertical band where dots are rendered. They travel from the bottom
// of this band up to the top, then loop.
const BAND_BOTTOM = SCREEN_H * 0.92;

// Three warm earth-tones that read against terracotta without
// fighting the cream timer for attention.
const COLOR_CREAM = '#F9F2E0';
const COLOR_SAND = '#EBDAB2';
const COLOR_SALMON = '#E8A99A';

interface DotConfig {
  startX: number;       // px from screen centre
  swayAmplitude: number;// horizontal sway range
  swayPhase: number;    // 0..1 phase offset for the sway sine
  delay: number;        // ms after mount before this dot enters
  peakOpacity: number;  // top of the fade — keeps dots faint
  size: number;         // dot diameter
  color: string;
}

// 14 dots, staggered ~1.1s apart so the layer is always populated.
// Sizes 3–5px, mixed colours, varied sway so neighbouring dots don't
// look like a synchronized pattern.
const DOTS: DotConfig[] = [
  { startX: -SCREEN_W * 0.36, swayAmplitude: 22, swayPhase: 0.0, delay: 0,     peakOpacity: 0.34, size: 4, color: COLOR_CREAM },
  { startX: -SCREEN_W * 0.18, swayAmplitude: 30, swayPhase: 0.3, delay: 1100,  peakOpacity: 0.42, size: 3, color: COLOR_SALMON },
  { startX:  SCREEN_W * 0.04, swayAmplitude: 18, swayPhase: 0.6, delay: 2200,  peakOpacity: 0.36, size: 5, color: COLOR_SAND },
  { startX:  SCREEN_W * 0.22, swayAmplitude: 26, swayPhase: 0.1, delay: 3300,  peakOpacity: 0.30, size: 3, color: COLOR_CREAM },
  { startX: -SCREEN_W * 0.30, swayAmplitude: 28, swayPhase: 0.4, delay: 4400,  peakOpacity: 0.44, size: 4, color: COLOR_SAND },
  { startX:  SCREEN_W * 0.34, swayAmplitude: 20, swayPhase: 0.7, delay: 5500,  peakOpacity: 0.32, size: 3, color: COLOR_SALMON },
  { startX: -SCREEN_W * 0.06, swayAmplitude: 24, swayPhase: 0.2, delay: 6600,  peakOpacity: 0.40, size: 5, color: COLOR_CREAM },
  { startX: -SCREEN_W * 0.40, swayAmplitude: 16, swayPhase: 0.5, delay: 7700,  peakOpacity: 0.28, size: 4, color: COLOR_SALMON },
  { startX:  SCREEN_W * 0.12, swayAmplitude: 32, swayPhase: 0.8, delay: 8800,  peakOpacity: 0.38, size: 3, color: COLOR_SAND },
  { startX:  SCREEN_W * 0.40, swayAmplitude: 22, swayPhase: 0.0, delay: 9900,  peakOpacity: 0.34, size: 4, color: COLOR_CREAM },
  { startX: -SCREEN_W * 0.10, swayAmplitude: 28, swayPhase: 0.55,delay: 11000, peakOpacity: 0.42, size: 5, color: COLOR_SALMON },
  { startX: -SCREEN_W * 0.26, swayAmplitude: 18, swayPhase: 0.25,delay: 12100, peakOpacity: 0.30, size: 3, color: COLOR_SAND },
  { startX:  SCREEN_W * 0.30, swayAmplitude: 26, swayPhase: 0.75,delay: 13200, peakOpacity: 0.36, size: 4, color: COLOR_CREAM },
  { startX:  SCREEN_W * 0.00, swayAmplitude: 14, swayPhase: 0.45,delay: 14300, peakOpacity: 0.38, size: 4, color: COLOR_SALMON },
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
      cancelAnimation(t);
      t.value = 0;
      return;
    }
    const timer = setTimeout(() => {
      t.value = withRepeat(
        withTiming(1, { duration: DOT_DURATION, easing: Easing.linear }),
        -1,
        false,
      );
    }, config.delay);
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
