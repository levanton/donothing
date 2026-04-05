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
      const snapped = Math.round((x * maxMinutes) / step) * step;
      internalProgress.value = snapped / maxMinutes;
      runOnJS(handleChange)(snapped);
    });

  const onLayout = useCallback((e: LayoutChangeEvent) => {
    const w = e.nativeEvent.layout.width;
    setMeasuredWidth(w);
    const t = w - pad * 2;
    trackW.value = t;
    if (value !== undefined) {
      internalProgress.value = value / maxMinutes;
    }
  }, [value, maxMinutes]);

  // Sync external value changes (interactive mode)
  if (isInteractive && lastSnap.current !== value && width > 0) {
    internalProgress.value = value / maxMinutes;
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
          <Text style={[styles.labelValue, { color: theme.text, fontFamily: Fonts!.serif }]}>
            {value === 0 ? 'not set' : `${value} min`}
          </Text>
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
          const tx = pad + (m / maxMinutes) * tw;
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
      <View style={[styles.scaleRow, { width, paddingHorizontal: pad - 4 }]}>
        {scaleLabels.map((label, i) => (
          <Text key={i} style={[styles.scaleLabel, { color: theme.textTertiary }]}>{label}</Text>
        ))}
      </View>
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
    alignItems: 'center',
    marginBottom: 12,
  },
  labelValue: {
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
