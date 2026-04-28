import { useCallback, useEffect, useState } from 'react';
import { LayoutChangeEvent, StyleSheet, Text, TextStyle, View } from 'react-native';
import { Gesture, GestureDetector } from 'react-native-gesture-handler';
import Animated, {
  runOnJS,
  useAnimatedProps,
  useSharedValue,
  type SharedValue,
} from 'react-native-reanimated';
import { haptics } from '@/lib/haptics';
import Svg, { Circle as SvgCircle, Line as SvgLine } from 'react-native-svg';

import { Fonts } from '@/constants/theme';

/**
 * Loose theme shape — onboarding screens pass `{ text, bg }` only,
 * while in-app callers pass full `AppTheme`. Optional fields fall
 * through to component defaults / explicit colour overrides.
 */
export interface GoalSliderTheme {
  text: string;
  bg: string;
  textSecondary?: string;
  textTertiary?: string;
}

const AnimatedCircle = Animated.createAnimatedComponent(SvgCircle);
const AnimatedLine = Animated.createAnimatedComponent(SvgLine);

const SLIDER_H = 24;
export const SLIDER_PAD = 10;

// Non-linear snap points: 0–10 by 1, then 15,20,25,30, then by 10 to 60, then by 15 to 120
const SNAP_POINTS = [
  0, 1, 2, 3, 4, 5, 6, 7, 8, 9, 10, 11, 12, 13, 14, 15,
  20, 25, 30, 35, 40, 45, 50, 55, 60,
  65, 70, 75, 80, 85, 90,
];

// Piecewise linear anchors — value → position mapping is split into segments
// between neighbouring breakpoints plus the implicit endpoints (0, 0) and
// (max, 1). Passing an optional third breakpoint gives four segments, which
// is what lets tick marks like 30/45/60/90 be equally spaced even though
// their value gaps aren't equal.
const DEFAULT_BP = { b1Val: 15, b1Pos: 0.375, b2Val: 60, b2Pos: 0.8 };

export interface PiecewiseBreakpoints {
  b1Val: number; b1Pos: number;
  b2Val: number; b2Pos: number;
  b3Val?: number; b3Pos?: number;
}

/** value → visual position (0–1) */
function valueToPos(v: number, max: number, bp: PiecewiseBreakpoints = DEFAULT_BP): number {
  'worklet';
  if (v <= bp.b1Val) return (v / bp.b1Val) * bp.b1Pos;
  if (v <= bp.b2Val) return bp.b1Pos + ((v - bp.b1Val) / (bp.b2Val - bp.b1Val)) * (bp.b2Pos - bp.b1Pos);
  if (bp.b3Val !== undefined && bp.b3Pos !== undefined) {
    if (v <= bp.b3Val) return bp.b2Pos + ((v - bp.b2Val) / (bp.b3Val - bp.b2Val)) * (bp.b3Pos - bp.b2Pos);
    return bp.b3Pos + ((v - bp.b3Val) / (max - bp.b3Val)) * (1 - bp.b3Pos);
  }
  return bp.b2Pos + ((v - bp.b2Val) / (max - bp.b2Val)) * (1 - bp.b2Pos);
}

/** visual position (0–1) → value */
function posToValue(p: number, max: number, bp: PiecewiseBreakpoints = DEFAULT_BP): number {
  'worklet';
  if (p <= bp.b1Pos) return (p / bp.b1Pos) * bp.b1Val;
  if (p <= bp.b2Pos) return bp.b1Val + ((p - bp.b1Pos) / (bp.b2Pos - bp.b1Pos)) * (bp.b2Val - bp.b1Val);
  if (bp.b3Val !== undefined && bp.b3Pos !== undefined) {
    if (p <= bp.b3Pos) return bp.b2Val + ((p - bp.b2Pos) / (bp.b3Pos - bp.b2Pos)) * (bp.b3Val - bp.b2Val);
    return bp.b3Val + ((p - bp.b3Pos) / (1 - bp.b3Pos)) * (max - bp.b3Val);
  }
  return bp.b2Val + ((p - bp.b2Pos) / (1 - bp.b2Pos)) * (max - bp.b2Val);
}

/** Snap a raw minute value to the nearest allowed snap point */
function snapToNearest(raw: number): number {
  'worklet';
  let best = SNAP_POINTS[0];
  for (let i = 1; i < SNAP_POINTS.length; i++) {
    if (Math.abs(SNAP_POINTS[i] - raw) < Math.abs(best - raw)) best = SNAP_POINTS[i];
  }
  return best;
}


interface GoalSliderBarProps {
  theme: GoalSliderTheme;
  /** Max value in minutes */
  maxMinutes?: number;
  /** Snap step in minutes (only for interactive mode) */
  step?: number;
  /** Tick marks in minutes */
  ticks?: number[];
  /** Scale labels shown below the track */
  scaleLabels?: string[];
  /** Fill/thumb color — defaults to theme.textSecondary */
  accentColor?: string;
  /** Override piecewise mapping breakpoints for different value ranges */
  breakpoints?: PiecewiseBreakpoints;
  /** Hide the built-in value label above the slider */
  hideLabel?: boolean;
  /** Override slider track height (default 24) */
  sliderHeight?: number;
  /** Override thumb radius (default 8 interactive / 7 controlled) */
  thumbRadius?: number;
  /** Override track stroke width (default 2.5 fill / 2 bg) */
  trackStrokeWidth?: number;
  /** Override background (unfilled) track color — defaults to theme.textTertiary */
  trackBgColor?: string;

  /** Override scale label text style */
  scaleLabelStyle?: TextStyle;

  // --- Controlled mode (main screen): pass progress + width, gesture is external ---
  progress?: SharedValue<number>;
  width?: number;

  // --- Interactive mode (settings): pass value + onChange, gesture is built-in ---
  value?: number;
  onChange?: (minutes: number) => void;
  /** Lower bound for interactive snapping (default 0) */
  minMinutes?: number;
}

export default function GoalSliderBar({
  theme,
  maxMinutes = 60,
  step = 5,
  ticks = [15, 30, 45],
  scaleLabels = ['0', String(maxMinutes)],
  accentColor,
  breakpoints: bp = DEFAULT_BP,
  hideLabel = false,
  sliderHeight,
  thumbRadius: thumbR,
  trackStrokeWidth,
  trackBgColor,
  scaleLabelStyle,
  progress: externalProgress,
  width: fixedWidth,
  value,
  onChange,
  minMinutes = 0,
}: GoalSliderBarProps) {
  const isInteractive = value !== undefined && onChange !== undefined;
  const color = accentColor ?? theme.textSecondary;
  const sH = sliderHeight ?? SLIDER_H;
  const tR = thumbR ?? (isInteractive ? 8 : 7);
  const tDotR = thumbR ? thumbR * 0.3 : (isInteractive ? 2.5 : 2);
  const fillSW = trackStrokeWidth ?? 2.5;
  const bgSW = trackStrokeWidth ? trackStrokeWidth * 0.8 : 2;

  // --- Interactive mode state ---
  const [measuredWidth, setMeasuredWidth] = useState(0);
  const [displayMins, setDisplayMins] = useState(value ?? 0);
  const internalProgress = useSharedValue(0);
  const trackW = useSharedValue(0);
  const lastSnap = useSharedValue(value ?? 0);

  const progress = externalProgress ?? internalProgress;
  const width = fixedWidth ?? measuredWidth;
  const pad = Math.max(SLIDER_PAD, tR + 2);
  const cy = sH / 2;
  const tw = width - pad * 2;

  // --- Interactive gesture ---
  // Called only when the snapped minute value actually changes — the
  // worklet dedupes via `lastSnap` so JS work happens once per
  // integer step, not 60× per second.
  const handleDisplayUpdate = useCallback((mins: number) => {
    haptics.select();
    setDisplayMins(mins);
    onChange?.(mins);
  }, [onChange]);

  const gesture = Gesture.Pan()
    .onUpdate((e) => {
      'worklet';
      const twVal = trackW.value;
      if (twVal === 0) return;
      const x = Math.max(0, Math.min(1, (e.x - pad) / twVal));
      const raw = posToValue(x, maxMinutes, bp);
      let snapped = snapToNearest(raw);
      if (snapped < minMinutes) snapped = minMinutes;
      internalProgress.value = valueToPos(snapped, maxMinutes, bp);
      // Cross to JS only on a real value change — the gesture fires
      // ~60×/sec but the snapped minute changes far less often.
      // Without this gate, every frame queues a setState + store
      // write which lags the timer numerals behind the thumb.
      if (snapped !== lastSnap.value) {
        lastSnap.value = snapped;
        runOnJS(handleDisplayUpdate)(snapped);
      }
    });

  const onLayout = useCallback((e: LayoutChangeEvent) => {
    const w = e.nativeEvent.layout.width;
    setMeasuredWidth(w);
    const t = w - pad * 2;
    requestAnimationFrame(() => {
      trackW.value = t;
      if (value !== undefined) {
        internalProgress.value = valueToPos(value, maxMinutes, bp);
      }
    });
  }, [value, maxMinutes]);

  // Sync external value changes (interactive mode)
  useEffect(() => {
    if (!isInteractive || width <= 0) return;
    requestAnimationFrame(() => {
      if (lastSnap.value !== value) {
        internalProgress.value = valueToPos(value!, maxMinutes, bp);
        lastSnap.value = value!;
        setDisplayMins(value!);
      }
    });
  }, [value, width]);

  // --- Animated props (UI thread) ---
  const fillProps = useAnimatedProps(() => ({
    x2: pad + progress.value * (fixedWidth ? fixedWidth - pad * 2 : trackW.value),
  }));

  const thumbProps = useAnimatedProps(() => ({
    cx: pad + progress.value * (fixedWidth ? fixedWidth - pad * 2 : trackW.value),
  }));

  const thumbDotProps = useAnimatedProps(() => ({
    cx: pad + progress.value * (fixedWidth ? fixedWidth - pad * 2 : trackW.value),
  }));

  // Wait for layout in interactive mode
  if (isInteractive && width === 0) {
    return <View onLayout={onLayout} style={{ height: sH + 44 }} />;
  }

  const slider = (
    <View style={{ width: fixedWidth, alignItems: isInteractive ? undefined : 'center' }} onLayout={isInteractive ? onLayout : undefined}>
      {isInteractive && !hideLabel && (
        <View style={styles.labelRow}>
          {displayMins === 0 ? (
            <Text style={[styles.labelValue, { color: theme.text, fontFamily: Fonts!.serif }]}>
              not set
            </Text>
          ) : (
            <View style={styles.labelParts}>
              <Text style={[styles.labelNumber, { color: theme.text, fontFamily: Fonts!.serif }]}>
                {displayMins}
              </Text>
              <Text style={[styles.labelUnit, { color: theme.text, fontFamily: Fonts!.serif }]}>
                {' '}min
              </Text>
            </View>
          )}
        </View>
      )}
      <Svg width={width} height={sH}>
        {/* Track */}
        <SvgLine
          x1={pad} y1={cy} x2={width - pad} y2={cy}
          stroke={trackBgColor ?? theme.textTertiary}
          strokeWidth={bgSW}
          strokeLinecap="round"
        />
        {/* Tick marks */}
        {ticks.map((m) => {
          const tx = pad + (isInteractive ? valueToPos(m, maxMinutes, bp) : m / maxMinutes) * tw;
          const filled = isInteractive ? displayMins >= m : false;
          return (
            <SvgLine
              key={m}
              x1={tx} y1={cy - 4} x2={tx} y2={cy + 4}
              stroke={filled ? color : (trackBgColor ?? theme.textTertiary)}
              strokeWidth={1.5}
            />
          );
        })}
        {/* Fill */}
        <AnimatedLine
          x1={pad} y1={cy} y2={cy}
          stroke={color}
          strokeWidth={fillSW}
          strokeLinecap="round"
          animatedProps={fillProps}
        />
        {/* Thumb */}
        <AnimatedCircle
          cy={cy} r={tR}
          fill={theme.bg}
          stroke={color}
          strokeWidth={2}
          animatedProps={thumbProps}
        />
        <AnimatedCircle
          cy={cy} r={tDotR}
          fill={color}
          animatedProps={thumbDotProps}
        />
      </Svg>
      {isInteractive && scaleLabels.length > 2 ? (
        <View style={[styles.scaleRow, { width, height: 16 }]}>
          {scaleLabels.map((label, i) => {
            const val = Number(label);
            const pos = valueToPos(val, maxMinutes, bp);
            return (
              <View
                key={i}
                style={{
                  position: 'absolute',
                  left: pad + pos * tw,
                  alignItems: 'center',
                  transform: [{ translateX: -20 }],
                  width: 40,
                }}
              >
                <Text style={[styles.scaleLabel, { color: theme.textTertiary }, scaleLabelStyle]}>
                  {label}
                </Text>
              </View>
            );
          })}
        </View>
      ) : (
        <View style={[styles.scaleRow, { width, paddingHorizontal: pad - 4 }]}>
          {scaleLabels.map((label, i) => (
            <Text key={i} style={[styles.scaleLabel, { color: theme.textTertiary }, scaleLabelStyle]}>{label}</Text>
          ))}
        </View>
      )}
    </View>
  );

  if (isInteractive) {
    return (
      <GestureDetector gesture={gesture}>
        {slider}
      </GestureDetector>
    );
  }

  return slider;
}

const styles = StyleSheet.create({
  labelRow: {
    alignItems: 'flex-start',
    justifyContent: 'flex-end',
    height: 56,
    marginBottom: 12,
  },
  labelValue: {
    fontSize: 22,
    fontWeight: '300',
  },
  labelParts: {
    flexDirection: 'row',
    alignItems: 'baseline',
  },
  labelNumber: {
    fontSize: 48,
    fontWeight: '300',
  },
  labelUnit: {
    fontSize: 22,
    fontWeight: '300',
  },
  scaleRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    marginTop: 4,
  },
  scaleLabel: {
    fontSize: 11,
    fontWeight: '300',
  },
});
