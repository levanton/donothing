import { useCallback, useEffect, useState } from 'react';
import { LayoutChangeEvent, StyleSheet, Text, TextInput, View } from 'react-native';
import { Gesture, GestureDetector } from 'react-native-gesture-handler';
import Animated, {
  runOnJS,
  useAnimatedProps,
  useAnimatedStyle,
  useSharedValue,
} from 'react-native-reanimated';
import * as Haptics from 'expo-haptics';
import Svg, { Line as SvgLine } from 'react-native-svg';

import { Fonts } from '@/constants/theme';
import type { AppTheme } from '@/lib/theme';

const AnimatedLine = Animated.createAnimatedComponent(SvgLine);
const AnimatedTextInput = Animated.createAnimatedComponent(TextInput);

const MINUTES_PER_DAY = 24 * 60;
const SLIDER_H = 44;
const THUMB_R = 14;
const THUMB_STROKE = 3;
const THUMB_SIZE = (THUMB_R + THUMB_STROKE) * 2;
const TRACK_SW = 3;
const FILL_SW = 4;

function pad2(n: number) {
  'worklet';
  return n < 10 ? `0${n}` : String(n);
}

function formatTime(m: number) {
  'worklet';
  const c = Math.max(0, Math.min(MINUTES_PER_DAY, Math.round(m)));
  const h = Math.floor(c / 60);
  const mm = c % 60;
  return `${pad2(h)}:${pad2(mm)}`;
}

function formatDuration(m: number) {
  'worklet';
  const total = Math.max(0, Math.round(m));
  const h = Math.floor(total / 60);
  const mm = total % 60;
  if (h === 0) return `${mm}m`;
  return `${h}h ${pad2(mm)}m`;
}

interface Props {
  startMinutes: number;
  endMinutes: number;
  onChange: (start: number, end: number) => void;
  theme: AppTheme;
  step?: number;
  minGap?: number;
  centerLabel?: string;
}

export default function TimeRangeSlider({
  startMinutes,
  endMinutes,
  onChange,
  theme,
  step = 5,
  minGap = 15,
  centerLabel = 'length',
}: Props) {
  const [width, setWidth] = useState(0);

  const snap = useCallback((v: number) => Math.round(v / step) * step, [step]);

  const startSV = useSharedValue(snap(startMinutes));
  const endSV = useSharedValue(snap(endMinutes));
  const trackW = useSharedValue(0);
  const activeThumb = useSharedValue<0 | 1 | 2>(0);
  const lastStepStart = useSharedValue(snap(startMinutes));
  const lastStepEnd = useSharedValue(snap(endMinutes));

  const cy = SLIDER_H / 2;

  const commit = useCallback(() => {
    onChange(snap(startSV.value), snap(endSV.value));
  }, [onChange, snap, startSV, endSV]);

  useEffect(() => {
    const s = snap(startMinutes);
    const e = snap(endMinutes);
    startSV.value = s;
    endSV.value = e;
    lastStepStart.value = s;
    lastStepEnd.value = e;
  }, [startMinutes, endMinutes, snap, startSV, endSV, lastStepStart, lastStepEnd]);

  const onLayout = useCallback((e: LayoutChangeEvent) => {
    const w = e.nativeEvent.layout.width;
    setWidth(w);
    requestAnimationFrame(() => {
      trackW.value = w;
    });
  }, [trackW]);

  const gesture = Gesture.Pan()
    .failOffsetY([-12, 12])
    .onStart((e) => {
      'worklet';
      const twVal = trackW.value;
      if (twVal <= 0) return;
      const touchMin = Math.max(
        0,
        Math.min(MINUTES_PER_DAY, (e.x / twVal) * MINUTES_PER_DAY),
      );
      const distStart = Math.abs(touchMin - startSV.value);
      const distEnd = Math.abs(touchMin - endSV.value);
      const mid = (startSV.value + endSV.value) / 2;
      const picked: 1 | 2 =
        distStart < distEnd
          ? 1
          : distEnd < distStart
            ? 2
            : touchMin < mid
              ? 1
              : 2;
      activeThumb.value = picked;
      if (picked === 1) {
        const clamped = Math.max(0, Math.min(endSV.value - minGap, touchMin));
        const snapped = Math.round(clamped / step) * step;
        if (snapped !== startSV.value) {
          startSV.value = snapped;
          if (snapped !== lastStepStart.value) {
            lastStepStart.value = snapped;
            runOnJS(Haptics.selectionAsync)();
          }
        }
      } else {
        const clamped = Math.min(MINUTES_PER_DAY, Math.max(startSV.value + minGap, touchMin));
        const snapped = Math.round(clamped / step) * step;
        if (snapped !== endSV.value) {
          endSV.value = snapped;
          if (snapped !== lastStepEnd.value) {
            lastStepEnd.value = snapped;
            runOnJS(Haptics.selectionAsync)();
          }
        }
      }
    })
    .onUpdate((e) => {
      'worklet';
      const twVal = trackW.value;
      if (twVal <= 0 || activeThumb.value === 0) return;
      const touchMin = Math.max(
        0,
        Math.min(MINUTES_PER_DAY, (e.x / twVal) * MINUTES_PER_DAY),
      );
      if (activeThumb.value === 1) {
        const clamped = Math.max(0, Math.min(endSV.value - minGap, touchMin));
        const snapped = Math.round(clamped / step) * step;
        if (snapped !== startSV.value) {
          startSV.value = snapped;
          if (snapped !== lastStepStart.value) {
            lastStepStart.value = snapped;
            runOnJS(Haptics.selectionAsync)();
          }
        }
      } else {
        const clamped = Math.min(MINUTES_PER_DAY, Math.max(startSV.value + minGap, touchMin));
        const snapped = Math.round(clamped / step) * step;
        if (snapped !== endSV.value) {
          endSV.value = snapped;
          if (snapped !== lastStepEnd.value) {
            lastStepEnd.value = snapped;
            runOnJS(Haptics.selectionAsync)();
          }
        }
      }
    })
    .onEnd(() => {
      'worklet';
      activeThumb.value = 0;
    })
    .onFinalize(() => {
      'worklet';
      activeThumb.value = 0;
      runOnJS(commit)();
    });

  const startThumbStyle = useAnimatedStyle(() => ({
    transform: [
      { translateX: (startSV.value / MINUTES_PER_DAY) * trackW.value - THUMB_SIZE / 2 },
    ],
  }));
  const endThumbStyle = useAnimatedStyle(() => ({
    transform: [
      { translateX: (endSV.value / MINUTES_PER_DAY) * trackW.value - THUMB_SIZE / 2 },
    ],
  }));
  const activeLineProps = useAnimatedProps(() => ({
    x1: (startSV.value / MINUTES_PER_DAY) * trackW.value,
    x2: (endSV.value / MINUTES_PER_DAY) * trackW.value,
  }));

  const startTextProps = useAnimatedProps(() => {
    const t = formatTime(startSV.value);
    return { text: t, defaultValue: t } as unknown as Record<string, string>;
  });
  const endTextProps = useAnimatedProps(() => {
    const t = formatTime(endSV.value);
    return { text: t, defaultValue: t } as unknown as Record<string, string>;
  });
  const durationTextProps = useAnimatedProps(() => {
    const t = formatDuration(endSV.value - startSV.value);
    return { text: t, defaultValue: t } as unknown as Record<string, string>;
  });

  return (
    <View style={styles.container}>
      <View style={styles.headerRow}>
        <View style={styles.sideCol}>
          <Text style={[styles.headerLabel, { color: theme.textTertiary }]}>start</Text>
          <AnimatedTextInput
            editable={false}
            underlineColorAndroid="transparent"
            style={[styles.timeValue, { color: theme.text, fontFamily: Fonts!.mono }]}
            animatedProps={startTextProps}
          />
        </View>
        <View style={styles.centerCol}>
          <Text style={[styles.headerLabel, { color: theme.textTertiary }]}>{centerLabel}</Text>
          <AnimatedTextInput
            editable={false}
            underlineColorAndroid="transparent"
            style={[styles.durationValue, { color: theme.text, fontFamily: Fonts!.mono }]}
            animatedProps={durationTextProps}
          />
        </View>
        <View style={[styles.sideCol, styles.rightAlign]}>
          <Text style={[styles.headerLabel, { color: theme.textTertiary, textAlign: 'right' }]}>
            end
          </Text>
          <AnimatedTextInput
            editable={false}
            underlineColorAndroid="transparent"
            style={[styles.timeValue, styles.rightText, { color: theme.text, fontFamily: Fonts!.mono }]}
            animatedProps={endTextProps}
          />
        </View>
      </View>

      <GestureDetector gesture={gesture}>
        <View style={styles.trackArea} onLayout={onLayout}>
          {width > 0 && (
            <>
              <Svg width={width} height={SLIDER_H} style={styles.svg}>
                <SvgLine
                  x1={0}
                  y1={cy}
                  x2={width}
                  y2={cy}
                  stroke={theme.textTertiary}
                  strokeWidth={TRACK_SW}
                  strokeLinecap="round"
                />
                {[6, 12, 18].map((h) => {
                  const tx = (h / 24) * width;
                  return (
                    <SvgLine
                      key={h}
                      x1={tx}
                      y1={cy - 5}
                      x2={tx}
                      y2={cy + 5}
                      stroke={theme.textTertiary}
                      strokeWidth={1}
                    />
                  );
                })}
                <AnimatedLine
                  y1={cy}
                  y2={cy}
                  stroke={theme.accent}
                  strokeWidth={FILL_SW}
                  strokeLinecap="round"
                  animatedProps={activeLineProps}
                />
              </Svg>
              <Animated.View
                pointerEvents="none"
                style={[
                  styles.thumb,
                  {
                    top: cy - THUMB_SIZE / 2,
                    backgroundColor: theme.bg,
                    borderColor: theme.accent,
                  },
                  startThumbStyle,
                ]}
              />
              <Animated.View
                pointerEvents="none"
                style={[
                  styles.thumb,
                  {
                    top: cy - THUMB_SIZE / 2,
                    backgroundColor: theme.bg,
                    borderColor: theme.accent,
                  },
                  endThumbStyle,
                ]}
              />
              <View style={styles.scaleRow}>
                {['00', '06', '12', '18', '24'].map((l, i) => (
                  <Text
                    key={l}
                    style={[
                      styles.scaleLabel,
                      {
                        color: theme.textTertiary,
                        fontFamily: Fonts!.mono,
                        textAlign: i === 0 ? 'left' : i === 4 ? 'right' : 'center',
                      },
                    ]}
                  >
                    {l}
                  </Text>
                ))}
              </View>
            </>
          )}
        </View>
      </GestureDetector>
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    width: '100%',
  },
  headerRow: {
    flexDirection: 'row',
    alignItems: 'flex-end',
    marginBottom: 20,
  },
  sideCol: {
    minWidth: 84,
  },
  centerCol: {
    alignItems: 'center',
    flex: 1,
  },
  rightAlign: {
    alignItems: 'flex-end',
  },
  headerLabel: {
    fontSize: 10,
    fontWeight: '400',
    letterSpacing: 1,
    textTransform: 'uppercase',
    marginBottom: 4,
  },
  timeValue: {
    fontSize: 32,
    fontWeight: '200',
    padding: 0,
    margin: 0,
    includeFontPadding: false,
    minWidth: 84,
  },
  rightText: {
    textAlign: 'right',
  },
  durationValue: {
    fontSize: 22,
    fontWeight: '300',
    padding: 0,
    margin: 0,
    includeFontPadding: false,
    textAlign: 'center',
  },
  trackArea: {
    height: SLIDER_H + 26,
    justifyContent: 'flex-start',
    overflow: 'visible',
  },
  svg: {
    overflow: 'visible',
  },
  thumb: {
    position: 'absolute',
    left: 0,
    width: THUMB_SIZE,
    height: THUMB_SIZE,
    borderRadius: THUMB_SIZE / 2,
    borderWidth: THUMB_STROKE,
  },
  scaleRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    marginTop: 4,
  },
  scaleLabel: {
    fontSize: 10,
    fontWeight: '400',
    letterSpacing: 1,
    flex: 1,
  },
});
