import { useCallback, useEffect, useState } from 'react';
import { LayoutChangeEvent, StyleSheet, Text, TextInput, View } from 'react-native';
import { Gesture, GestureDetector } from 'react-native-gesture-handler';
import Animated, {
  runOnJS,
  useAnimatedProps,
  useSharedValue,
} from 'react-native-reanimated';
import * as Haptics from 'expo-haptics';
import Svg, {
  Circle as SvgCircle,
  Line as SvgLine,
  Path as SvgPath,
  Text as SvgText,
} from 'react-native-svg';

import { Fonts } from '@/constants/theme';
import type { AppTheme } from '@/lib/theme';

const AnimatedPath = Animated.createAnimatedComponent(SvgPath);
const AnimatedCircle = Animated.createAnimatedComponent(SvgCircle);
const AnimatedTextInput = Animated.createAnimatedComponent(TextInput);

const MINUTES_PER_DAY = 24 * 60;
const TWO_PI = 2 * Math.PI;
const MAX_DIAL = 260;
const NUMBER_OFFSET = 14;
const NUMBER_FONT_SIZE = 10;
const NUMBER_PADDING = 22; // outer space for hour numbers
const THUMB_R = 10;
const THUMB_DOT_R = 2.5;
const THUMB_STROKE = 2;
const TRACK_SW = 2;
const FILL_SW = 5;

function pad2(n: number) {
  'worklet';
  return n < 10 ? `0${n}` : String(n);
}

function formatTime(m: number) {
  'worklet';
  const c = ((Math.round(m) % MINUTES_PER_DAY) + MINUTES_PER_DAY) % MINUTES_PER_DAY;
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

// Clockwise distance from a (in [0, 1440)) going around to b (in [0, 1440)).
function cwDistance(a: number, b: number) {
  'worklet';
  const d = b - a;
  return d >= 0 ? d : d + MINUTES_PER_DAY;
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
  const [size, setSize] = useState(0);

  const snap = useCallback((v: number) => {
    const m = ((Math.round(v / step) * step) % MINUTES_PER_DAY + MINUTES_PER_DAY) % MINUTES_PER_DAY;
    return m;
  }, [step]);

  const startSV = useSharedValue(snap(startMinutes));
  const endSV = useSharedValue(snap(endMinutes));
  const cxSV = useSharedValue(0);
  const cySV = useSharedValue(0);
  const rSV = useSharedValue(0);
  const activeThumb = useSharedValue<0 | 1 | 2>(0);
  const lastStepStart = useSharedValue(snap(startMinutes));
  const lastStepEnd = useSharedValue(snap(endMinutes));

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
    setSize(Math.min(w, MAX_DIAL));
  }, []);

  // Geometry
  const cx = size / 2;
  const cy = size / 2;
  const R = Math.max(0, size / 2 - NUMBER_PADDING);

  useEffect(() => {
    cxSV.value = cx;
    cySV.value = cy;
    rSV.value = R;
  }, [cx, cy, R, cxSV, cySV, rSV]);

  const gesture = Gesture.Pan()
    .onStart((e) => {
      'worklet';
      const r = rSV.value;
      if (r <= 0) return;
      const dx = e.x - cxSV.value;
      const dy = e.y - cySV.value;
      let touchAngle = Math.atan2(dx, -dy);
      if (touchAngle < 0) touchAngle += TWO_PI;
      const touchMin = (touchAngle / TWO_PI) * MINUTES_PER_DAY;

      // Pick closest thumb (angularly)
      const dStart = Math.min(
        Math.abs(touchMin - startSV.value),
        MINUTES_PER_DAY - Math.abs(touchMin - startSV.value),
      );
      const dEnd = Math.min(
        Math.abs(touchMin - endSV.value),
        MINUTES_PER_DAY - Math.abs(touchMin - endSV.value),
      );
      const picked: 1 | 2 = dStart <= dEnd ? 1 : 2;
      activeThumb.value = picked;

      const snapped = ((Math.round(touchMin / step) * step) % MINUTES_PER_DAY + MINUTES_PER_DAY) % MINUTES_PER_DAY;
      if (picked === 1) {
        // Need to ensure cwDistance(snapped, end) >= minGap
        const gap = cwDistance(snapped, endSV.value);
        let next = snapped;
        if (gap < minGap) {
          next = (endSV.value - minGap + MINUTES_PER_DAY) % MINUTES_PER_DAY;
          next = Math.round(next / step) * step;
        }
        if (next !== startSV.value) {
          startSV.value = next;
          if (next !== lastStepStart.value) {
            lastStepStart.value = next;
            runOnJS(Haptics.selectionAsync)();
          }
        }
      } else {
        const gap = cwDistance(startSV.value, snapped);
        let next = snapped;
        if (gap < minGap) {
          next = (startSV.value + minGap) % MINUTES_PER_DAY;
          next = Math.round(next / step) * step;
        }
        if (next !== endSV.value) {
          endSV.value = next;
          if (next !== lastStepEnd.value) {
            lastStepEnd.value = next;
            runOnJS(Haptics.selectionAsync)();
          }
        }
      }
    })
    .onUpdate((e) => {
      'worklet';
      const r = rSV.value;
      if (r <= 0 || activeThumb.value === 0) return;
      const dx = e.x - cxSV.value;
      const dy = e.y - cySV.value;
      let touchAngle = Math.atan2(dx, -dy);
      if (touchAngle < 0) touchAngle += TWO_PI;
      const touchMin = (touchAngle / TWO_PI) * MINUTES_PER_DAY;
      const snapped = ((Math.round(touchMin / step) * step) % MINUTES_PER_DAY + MINUTES_PER_DAY) % MINUTES_PER_DAY;

      if (activeThumb.value === 1) {
        const gap = cwDistance(snapped, endSV.value);
        let next = snapped;
        if (gap < minGap) {
          next = (endSV.value - minGap + MINUTES_PER_DAY) % MINUTES_PER_DAY;
          next = Math.round(next / step) * step;
        }
        if (next !== startSV.value) {
          startSV.value = next;
          if (next !== lastStepStart.value) {
            lastStepStart.value = next;
            runOnJS(Haptics.selectionAsync)();
          }
        }
      } else {
        const gap = cwDistance(startSV.value, snapped);
        let next = snapped;
        if (gap < minGap) {
          next = (startSV.value + minGap) % MINUTES_PER_DAY;
          next = Math.round(next / step) * step;
        }
        if (next !== endSV.value) {
          endSV.value = next;
          if (next !== lastStepEnd.value) {
            lastStepEnd.value = next;
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

  const startThumbProps = useAnimatedProps(() => {
    const r = rSV.value;
    const angle = (startSV.value / MINUTES_PER_DAY) * TWO_PI;
    return {
      cx: cxSV.value + r * Math.sin(angle),
      cy: cySV.value - r * Math.cos(angle),
    };
  });

  const endThumbProps = useAnimatedProps(() => {
    const r = rSV.value;
    const angle = (endSV.value / MINUTES_PER_DAY) * TWO_PI;
    return {
      cx: cxSV.value + r * Math.sin(angle),
      cy: cySV.value - r * Math.cos(angle),
    };
  });

  const activeArcProps = useAnimatedProps(() => {
    const r = rSV.value;
    if (r <= 0) return { d: '' };
    const cxV = cxSV.value;
    const cyV = cySV.value;
    const sAng = (startSV.value / MINUTES_PER_DAY) * TWO_PI;
    let eAng = (endSV.value / MINUTES_PER_DAY) * TWO_PI;
    while (eAng <= sAng) eAng += TWO_PI;
    const span = eAng - sAng;
    const sx = cxV + r * Math.sin(sAng);
    const sy = cyV - r * Math.cos(sAng);
    const ex = cxV + r * Math.sin(eAng);
    const ey = cyV - r * Math.cos(eAng);
    const largeArc = span > Math.PI ? 1 : 0;
    return { d: `M ${sx} ${sy} A ${r} ${r} 0 ${largeArc} 1 ${ex} ${ey}` };
  });

  const startTextProps = useAnimatedProps(() => {
    const t = formatTime(startSV.value);
    return { text: t, defaultValue: t } as unknown as Record<string, string>;
  });
  const endTextProps = useAnimatedProps(() => {
    const t = formatTime(endSV.value);
    return { text: t, defaultValue: t } as unknown as Record<string, string>;
  });
  const durationTextProps = useAnimatedProps(() => {
    const e = endSV.value >= startSV.value
      ? endSV.value - startSV.value
      : endSV.value + MINUTES_PER_DAY - startSV.value;
    const t = formatDuration(e);
    return { text: t, defaultValue: t } as unknown as Record<string, string>;
  });

  // Tick marks every 30 minutes (48 ticks). Hours are major, halves minor.
  const allTicks = Array.from({ length: 48 }, (_, i) => i);
  const tickMarks = allTicks.map((i) => {
    const m = i * 30;
    const angle = (m / MINUTES_PER_DAY) * TWO_PI;
    const isHour = m % 60 === 0;
    const isMajor = m % 360 === 0; // every 6h
    const len = isMajor ? 8 : isHour ? 4 : 2;
    const inner = R - len;
    return {
      i,
      angle,
      x1: cx + inner * Math.sin(angle),
      y1: cy - inner * Math.cos(angle),
      x2: cx + R * Math.sin(angle),
      y2: cy - R * Math.cos(angle),
      isMajor,
      isHour,
    };
  });

  // Hour labels — every 3 hours (8 labels), just outside the ring.
  const labelR = R + NUMBER_OFFSET;
  const hourLabels = [0, 3, 6, 9, 12, 15, 18, 21].map((h) => {
    const angle = (h / 24) * TWO_PI;
    const x = cx + labelR * Math.sin(angle);
    const y = cy - labelR * Math.cos(angle);
    return { h, x, y };
  });

  return (
    <View style={styles.container}>
      <View style={[styles.headerRow]}>
        <View style={styles.sideCol}>
          <Text style={[styles.fieldLabel, { color: theme.textTertiary }]}>start</Text>
          <AnimatedTextInput
            editable={false}
            underlineColorAndroid="transparent"
            style={[styles.endpointValue, { color: theme.text, fontFamily: Fonts!.mono }]}
            animatedProps={startTextProps}
          />
        </View>
        <View style={[styles.sideCol, styles.rightAlign]}>
          <Text style={[styles.fieldLabel, { color: theme.textTertiary, textAlign: 'right' }]}>end</Text>
          <AnimatedTextInput
            editable={false}
            underlineColorAndroid="transparent"
            style={[styles.endpointValue, styles.rightText, { color: theme.text, fontFamily: Fonts!.mono }]}
            animatedProps={endTextProps}
          />
        </View>
      </View>

      <View style={styles.dialWrap} onLayout={onLayout}>
        <GestureDetector gesture={gesture}>
          <View style={[styles.dialSquare, { width: size, height: size }]}>
            {size > 0 && (
              <>
                <Svg width={size} height={size}>
                  {/* Background ring */}
                  <SvgCircle
                    cx={cx}
                    cy={cy}
                    r={R}
                    fill="none"
                    stroke={theme.textTertiary}
                    strokeOpacity={0.45}
                    strokeWidth={TRACK_SW}
                  />
                  {/* 15-min tick marks; hours and 6h marks are bolder */}
                  {tickMarks.map((t) => (
                    <SvgLine
                      key={t.i}
                      x1={t.x1}
                      y1={t.y1}
                      x2={t.x2}
                      y2={t.y2}
                      stroke={theme.textTertiary}
                      strokeOpacity={t.isMajor ? 0.85 : t.isHour ? 0.55 : 0.3}
                      strokeWidth={t.isMajor ? 1.6 : t.isHour ? 1.1 : 0.8}
                    />
                  ))}

                  {/* Active arc */}
                  <AnimatedPath
                    fill="none"
                    stroke={theme.accent}
                    strokeWidth={FILL_SW}
                    strokeLinecap="round"
                    animatedProps={activeArcProps}
                  />

                  {/* All 24 hour labels just outside the ring */}
                  {hourLabels.map(({ h, x, y }) => (
                    <SvgText
                      key={h}
                      x={x}
                      y={y + NUMBER_FONT_SIZE / 3}
                      fontSize={NUMBER_FONT_SIZE}
                      fontFamily={Fonts!.mono}
                      fill={theme.textTertiary}
                      fillOpacity={h % 6 === 0 ? 1 : 0.55}
                      textAnchor="middle"
                    >
                      {pad2(h)}
                    </SvgText>
                  ))}

                  {/* Start thumb — filled accent */}
                  <AnimatedCircle
                    r={THUMB_R}
                    fill={theme.accent}
                    animatedProps={startThumbProps}
                  />
                  <AnimatedCircle
                    r={THUMB_DOT_R}
                    fill={theme.bg}
                    animatedProps={startThumbProps}
                  />
                  {/* End thumb — filled accent */}
                  <AnimatedCircle
                    r={THUMB_R}
                    fill={theme.accent}
                    animatedProps={endThumbProps}
                  />
                  <AnimatedCircle
                    r={THUMB_DOT_R}
                    fill={theme.bg}
                    animatedProps={endThumbProps}
                  />
                </Svg>

                {/* Center: length value (serif) */}
                <View pointerEvents="none" style={styles.centerOverlay}>
                  <Text style={[styles.fieldLabel, { color: theme.textTertiary, textAlign: 'center' }]}>
                    {centerLabel}
                  </Text>
                  <AnimatedTextInput
                    editable={false}
                    underlineColorAndroid="transparent"
                    style={[styles.lengthValue, { color: theme.text, fontFamily: Fonts!.serif }]}
                    animatedProps={durationTextProps}
                  />
                </View>
              </>
            )}
          </View>
        </GestureDetector>
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    width: '100%',
    alignItems: 'center',
  },
  headerRow: {
    flexDirection: 'row',
    width: '100%',
    alignItems: 'flex-end',
    marginBottom: 8,
  },
  sideCol: {
    flex: 1,
  },
  rightAlign: {
    alignItems: 'flex-end',
  },
  rightText: {
    textAlign: 'right',
  },
  fieldLabel: {
    fontSize: 10,
    fontWeight: '400',
    letterSpacing: 1,
    textTransform: 'uppercase',
    marginBottom: 4,
  },
  endpointValue: {
    fontSize: 24,
    fontWeight: '300',
    padding: 0,
    margin: 0,
    includeFontPadding: false,
  },
  dialWrap: {
    width: '100%',
    maxWidth: MAX_DIAL,
    aspectRatio: 1,
    alignItems: 'center',
    justifyContent: 'center',
  },
  dialSquare: {
    position: 'relative',
    overflow: 'visible',
  },
  centerOverlay: {
    position: 'absolute',
    left: 0,
    right: 0,
    top: 0,
    bottom: 0,
    alignItems: 'center',
    justifyContent: 'center',
  },
  lengthValue: {
    fontSize: 32,
    fontWeight: '400',
    padding: 0,
    margin: 0,
    includeFontPadding: false,
    textAlign: 'center',
    minWidth: 140,
    letterSpacing: -0.5,
  },
});
