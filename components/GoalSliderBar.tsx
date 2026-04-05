import { useCallback, useRef, useState } from 'react';
import { LayoutChangeEvent, StyleSheet, Text, View } from 'react-native';
import { Gesture, GestureDetector } from 'react-native-gesture-handler';
import Animated, {
  runOnJS,
  useAnimatedProps,
  useSharedValue,
} from 'react-native-reanimated';
import * as Haptics from 'expo-haptics';
import Svg, { Circle as SvgCircle, Line as SvgLine } from 'react-native-svg';

import { Fonts } from '@/constants/theme';

const AnimatedCircle = Animated.createAnimatedComponent(SvgCircle);
const AnimatedLine = Animated.createAnimatedComponent(SvgLine);

const SLIDER_H = 24;
export const SLIDER_PAD = 10;

// Non-linear snap points: 0–10 by 1, then 15,20,25,30, then by 10 to 60, then by 15 to 120
const SNAP_POINTS = [
  0, 1, 2, 3, 4, 5, 6, 7, 8, 9, 10,
  15, 20, 25, 30,
  40, 50, 60,
  75, 90, 105, 120,
];

/** Map a 0–1 slider position to a snap value */
function positionToValue(x: number): number {
  'worklet';
  const idx = Math.round(x * (SNAP_POINTS.length - 1));
  return SNAP_POINTS[Math.max(0, Math.min(SNAP_POINTS.length - 1, idx))];
}

/** Map a snap value to a 0–1 slider position */
function valueToPosition(v: number): number {
  'worklet';
  const idx = SNAP_POINTS.indexOf(v);
  if (idx >= 0) return idx / (SNAP_POINTS.length - 1);
  // Fallback: find closest
  let closest = 0;
  for (let i = 1; i < SNAP_POINTS.length; i++) {
    if (Math.abs(SNAP_POINTS[i] - v) < Math.abs(SNAP_POINTS[closest] - v)) closest = i;
  }
  return closest / (SNAP_POINTS.length - 1);
}

interface GoalSliderBarProps {
  theme: any;
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

  // --- Controlled mode (main screen): pass progress + width, gesture is external ---
  progress?: Animated.SharedValue<number>;
  width?: number;

  // --- Interactive mode (settings): pass value + onChange, gesture is built-in ---
  value?: number;
  onChange?: (minutes: number) => void;
}

export default function GoalSliderBar({
  theme,
  maxMinutes = 60,
  step = 5,
  ticks = [15, 30, 45],
  scaleLabels = ['0', String(maxMinutes)],
  accentColor,
  progress: externalProgress,
  width: fixedWidth,
  value,
  onChange,
}: GoalSliderBarProps) {
  const isInteractive = value !== undefined && onChange !== undefined;
  const color = accentColor ?? theme.textSecondary;

  // --- Interactive mode state ---
  const [measuredWidth, setMeasuredWidth] = useState(0);
  const internalProgress = useSharedValue(0);
  const trackW = useSharedValue(0);
  const lastSnap = useRef(value ?? 0);

  const progress = externalProgress ?? internalProgress;
  const width = fixedWidth ?? measuredWidth;
  const pad = SLIDER_PAD;
  const cy = SLIDER_H / 2;
  const tw = width - pad * 2;

  // --- Interactive gesture ---
  const handleChange = useCallback((mins: number) => {
    if (mins !== lastSnap.current) {
      lastSnap.current = mins;
      Haptics.selectionAsync();
      onChange?.(mins);
    }
  }, [onChange]);

  const gesture = Gesture.Pan()
    .onUpdate((e) => {
      'worklet';
      const twVal = trackW.value;
      if (twVal === 0) return;
      const x = Math.max(0, Math.min(1, (e.x - pad) / twVal));
      const snapped = positionToValue(x);
      internalProgress.value = valueToPosition(snapped);
      runOnJS(handleChange)(snapped);
    });

  const onLayout = useCallback((e: LayoutChangeEvent) => {
    const w = e.nativeEvent.layout.width;
    setMeasuredWidth(w);
    const t = w - pad * 2;
    trackW.value = t;
    if (value !== undefined) {
      internalProgress.value = valueToPosition(value);
    }
  }, [value]);

  // Sync external value changes (interactive mode)
  if (isInteractive && lastSnap.current !== value && width > 0) {
    internalProgress.value = valueToPosition(value);
    lastSnap.current = value;
  }

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
    return <View onLayout={onLayout} style={{ height: SLIDER_H + 44 }} />;
  }

  const slider = (
    <View style={{ width: fixedWidth, alignItems: isInteractive ? undefined : 'center' }} onLayout={isInteractive ? onLayout : undefined}>
      {isInteractive && (
        <View style={styles.labelRow}>
          {value === 0 ? (
            <Text style={[styles.labelValue, { color: theme.text, fontFamily: Fonts!.serif }]}>
              not set
            </Text>
          ) : (
            <View style={styles.labelParts}>
              <Text style={[styles.labelNumber, { color: theme.text, fontFamily: Fonts!.serif }]}>
                {value}
              </Text>
              <Text style={[styles.labelUnit, { color: theme.text, fontFamily: Fonts!.serif }]}>
                {' '}min
              </Text>
            </View>
          )}
        </View>
      )}
      <Svg width={width} height={SLIDER_H}>
        {/* Track */}
        <SvgLine
          x1={pad} y1={cy} x2={width - pad} y2={cy}
          stroke={theme.border}
          strokeWidth={2}
          strokeLinecap="round"
        />
        {/* Tick marks */}
        {ticks.map((m) => {
          const tx = pad + (isInteractive ? valueToPosition(m) : m / maxMinutes) * tw;
          return (
            <SvgLine
              key={m}
              x1={tx} y1={cy - 4} x2={tx} y2={cy + 4}
              stroke={theme.border}
              strokeWidth={1}
            />
          );
        })}
        {/* Fill */}
        <AnimatedLine
          x1={pad} y1={cy} y2={cy}
          stroke={color}
          strokeWidth={2.5}
          strokeLinecap="round"
          animatedProps={fillProps}
        />
        {/* Thumb */}
        <AnimatedCircle
          cy={cy} r={isInteractive ? 8 : 7}
          fill={theme.bg}
          stroke={color}
          strokeWidth={2}
          animatedProps={thumbProps}
        />
        <AnimatedCircle
          cy={cy} r={isInteractive ? 2.5 : 2}
          fill={color}
          animatedProps={thumbDotProps}
        />
      </Svg>
      {isInteractive ? (
        <View style={[styles.scaleRow, { width, height: 16 }]}>
          {scaleLabels.map((label, i) => {
            const val = Number(label);
            const pos = valueToPosition(val);
            return (
              <Text
                key={i}
                style={[styles.scaleLabel, {
                  color: theme.textTertiary,
                  position: 'absolute',
                  left: pad + pos * tw - 8,
                }]}
              >
                {label}
              </Text>
            );
          })}
        </View>
      ) : (
        <View style={[styles.scaleRow, { width, paddingHorizontal: pad - 4 }]}>
          {scaleLabels.map((label, i) => (
            <Text key={i} style={[styles.scaleLabel, { color: theme.textTertiary }]}>{label}</Text>
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
