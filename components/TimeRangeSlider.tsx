import { useCallback, useEffect, useState } from 'react';
import { LayoutChangeEvent, StyleSheet, Text, TextInput, View } from 'react-native';
import { Gesture, GestureDetector } from 'react-native-gesture-handler';
import Animated, {
  runOnJS,
  useAnimatedProps,
  useSharedValue,
} from 'react-native-reanimated';
import * as Haptics from 'expo-haptics';
import Svg, { Circle as SvgCircle, Line as SvgLine } from 'react-native-svg';

import { Fonts } from '@/constants/theme';
import type { AppTheme } from '@/lib/theme';

const AnimatedCircle = Animated.createAnimatedComponent(SvgCircle);
const AnimatedLine = Animated.createAnimatedComponent(SvgLine);
const AnimatedTextInput = Animated.createAnimatedComponent(TextInput);

const MINUTES_PER_DAY = 24 * 60;
const SLIDER_H = 40;
const SLIDER_PAD = 14;
const THUMB_R = 11;
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
  if (mm === 0) return `${h}h`;
  return `${h}h ${mm}m`;
}

interface Props {
  startMinutes: number;
  endMinutes: number;
  onChange: (start: number, end: number) => void;
  theme: AppTheme;
  step?: number;
  minGap?: number;
}

export default function TimeRangeSlider({
  startMinutes,
  endMinutes,
  onChange,
  theme,
  step = 5,
  minGap = 15,
}: Props) {
  const [width, setWidth] = useState(0);

  const snap = useCallback((v: number) => Math.round(v / step) * step, [step]);

  const startSV = useSharedValue(snap(startMinutes));
  const endSV = useSharedValue(snap(endMinutes));
  const trackW = useSharedValue(0);
  // 0 = idle, 1 = dragging start, 2 = dragging end
  const activeThumb = useSharedValue<0 | 1 | 2>(0);
  const dragBase = useSharedValue(0);
  const lastStepStart = useSharedValue(snap(startMinutes));
  const lastStepEnd = useSharedValue(snap(endMinutes));

  const tw = width > 0 ? width - SLIDER_PAD * 2 : 0;
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
      trackW.value = w - SLIDER_PAD * 2;
    });
  }, [trackW]);

  const gesture = Gesture.Pan()
    .activeOffsetX([-3, 3])
    .failOffsetY([-12, 12])
    .onStart((e) => {
      'worklet';
      const twVal = trackW.value;
      if (twVal <= 0) return;
      const touchMin = Math.max(
        0,
        Math.min(MINUTES_PER_DAY, ((e.x - SLIDER_PAD) / twVal) * MINUTES_PER_DAY),
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
      dragBase.value = picked === 1 ? startSV.value : endSV.value;
    })
    .onUpdate((e) => {
      'worklet';
      const twVal = trackW.value;
      if (twVal <= 0 || activeThumb.value === 0) return;
      const deltaMin = (e.translationX / twVal) * MINUTES_PER_DAY;
      const raw = dragBase.value + deltaMin;
      if (activeThumb.value === 1) {
        const clamped = Math.max(0, Math.min(endSV.value - minGap, raw));
        const snapped = Math.round(clamped / step) * step;
        if (snapped !== startSV.value) {
          startSV.value = snapped;
          if (snapped !== lastStepStart.value) {
            lastStepStart.value = snapped;
            runOnJS(Haptics.selectionAsync)();
          }
        }
      } else {
        const clamped = Math.min(MINUTES_PER_DAY, Math.max(startSV.value + minGap, raw));
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
      runOnJS(commit)();
    })
    .onFinalize(() => {
      'worklet';
      activeThumb.value = 0;
    });

  const startThumbProps = useAnimatedProps(() => ({
    cx: SLIDER_PAD + (startSV.value / MINUTES_PER_DAY) * trackW.value,
  }));
  const endThumbProps = useAnimatedProps(() => ({
    cx: SLIDER_PAD + (endSV.value / MINUTES_PER_DAY) * trackW.value,
  }));
  const activeLineProps = useAnimatedProps(() => ({
    x1: SLIDER_PAD + (startSV.value / MINUTES_PER_DAY) * trackW.value,
    x2: SLIDER_PAD + (endSV.value / MINUTES_PER_DAY) * trackW.value,
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
          <Text style={[styles.headerLabel, { color: theme.textTertiary }]}>do nothing</Text>
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
              <Svg width={width} height={SLIDER_H}>
                <SvgLine
                  x1={SLIDER_PAD}
                  y1={cy}
                  x2={width - SLIDER_PAD}
                  y2={cy}
                  stroke={theme.textTertiary}
                  strokeWidth={TRACK_SW}
                  strokeLinecap="round"
                />
                {[6, 12, 18].map((h) => {
                  const tx = SLIDER_PAD + (h / 24) * tw;
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
                <AnimatedCircle
                  cy={cy}
                  r={THUMB_R}
                  fill={theme.bg}
                  stroke={theme.accent}
                  strokeWidth={3}
                  animatedProps={startThumbProps}
                />
                <AnimatedCircle
                  cy={cy}
                  r={THUMB_R}
                  fill={theme.bg}
                  stroke={theme.accent}
                  strokeWidth={3}
                  animatedProps={endThumbProps}
                />
              </Svg>
              <View style={[styles.scaleRow, { width, paddingHorizontal: SLIDER_PAD - 4 }]}>
                {['00', '06', '12', '18', '24'].map((l) => (
                  <Text
                    key={l}
                    style={[styles.scaleLabel, { color: theme.textTertiary, fontFamily: Fonts!.mono }]}
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
    marginBottom: 18,
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
    height: SLIDER_H + 24,
    justifyContent: 'flex-start',
  },
  scaleRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    marginTop: 2,
  },
  scaleLabel: {
    fontSize: 10,
    fontWeight: '400',
    letterSpacing: 1,
  },
});
