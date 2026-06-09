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

// When `allowInfinity` is on, the ∞ stop is folded into the slider itself as
// the last stop. The value range (1..max) is compressed into the left
// `MAIN_FRAC` of the track; the empty span up to `INF_FRAC` is the breathing
// gap between the last number and ∞, which sits at `INF_FRAC` of the track.
const MAIN_FRAC = 0.88;
const INF_FRAC = 1;
// Value reported (via value / onChange) when the ∞ stop is selected. Outside
// the interactive [minMinutes, max] range, so it never collides with a real
// snap point. Consumers map this to their own open-ended behaviour.
export const OPEN_ENDED = 0;

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


interface AnimatedTickProps {
  tx: number;
  cy: number;
  threshold: number;
  activeColor: string;
  inactiveColor: string;
  lastSnap: SharedValue<number>;
  /** When 1 the whole track reads as filled (∞ selected), so every tick is active. */
  infinityActive: SharedValue<number>;
}

function AnimatedTick({ tx, cy, threshold, activeColor, inactiveColor, lastSnap, infinityActive }: AnimatedTickProps) {
  const animatedProps = useAnimatedProps(() => ({
    stroke: infinityActive.value || lastSnap.value >= threshold ? activeColor : inactiveColor,
  }));
  return (
    <AnimatedLine
      x1={tx} y1={cy - 4} x2={tx} y2={cy + 4}
      strokeWidth={1.5}
      animatedProps={animatedProps}
    />
  );
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
  /** Fired once when the user releases the slider, with the final
   * snapped value. Use this for store writes that fan out to the rest
   * of the screen — onChange fires per snap step and is fine for
   * tightly memoised display state, but anything that triggers
   * widespread re-renders should hook into onRelease instead. */
  onRelease?: (minutes: number) => void;
  /** Lower bound for interactive snapping (default 0) */
  minMinutes?: number;
  /** Opt-in: render a separated ∞ stop to the right of the scale. Dragging
   *  the thumb into it reports `OPEN_ENDED` (0); the main track shows fully
   *  filled and the ∞ marker becomes the active knob. Off for callers that
   *  don't want an open-ended option (e.g. BlockPicker). */
  allowInfinity?: boolean;
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
  onRelease,
  minMinutes = 0,
  allowInfinity = false,
}: GoalSliderBarProps) {
  const isInteractive = value !== undefined && onChange !== undefined;
  const color: string = accentColor ?? theme.textSecondary ?? theme.text;
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
  // UI-thread flag: 1 while the ∞ stop is selected. Drives the "fully filled
  // track + thumb parked on ∞" look without round-tripping through JS.
  const infinityActive = useSharedValue(allowInfinity && value === OPEN_ENDED ? 1 : 0);
  // While true, prop-driven sync is suppressed. Without this, the
  // gesture worklet advances `lastSnap` faster than the store-roundtrip
  // can echo `value` back, so the sync effect repeatedly snaps the
  // thumb back to a stale value and the slider stutters mid-drag.
  const isDragging = useSharedValue(false);

  const progress = externalProgress ?? internalProgress;
  const width = fixedWidth ?? measuredWidth;
  const pad = Math.max(SLIDER_PAD, tR + 2);
  const cy = sH / 2;
  const tw = width - pad * 2;
  // Fraction of the track the value range occupies (rest is the ∞ gap + stop).
  const mainFrac = allowInfinity ? MAIN_FRAC : 1;
  // ∞ stop x — the last stop on the slider, after the gap past the "60" end.
  const infStopX = pad + INF_FRAC * tw;

  // --- Interactive gesture ---
  // Called only when the snapped minute value actually changes — the
  // worklet dedupes via `lastSnap` so JS work happens once per
  // integer step, not 60× per second.
  const handleDisplayUpdate = useCallback((mins: number) => {
    haptics.select();
    setDisplayMins(mins);
    onChange?.(mins);
  }, [onChange]);

  // Snap to the touch point — used by both onBegin (tap/initial touch)
  // and onUpdate (drag). Pulled out so a tap on the track moves the
  // thumb instantly, with no minDistance delay before activation.
  const snapToTouch = (eventX: number) => {
    'worklet';
    const twVal = trackW.value;
    if (twVal === 0) return;
    const xfull = Math.max(0, Math.min(1, (eventX - pad) / twVal));
    // Dragged past the value range into the gap → snap to ∞ (the last stop).
    if (allowInfinity && xfull >= (MAIN_FRAC + INF_FRAC) / 2) {
      infinityActive.value = 1;
      internalProgress.value = 1;
      if (lastSnap.value !== OPEN_ENDED) {
        lastSnap.value = OPEN_ENDED;
        runOnJS(handleDisplayUpdate)(OPEN_ENDED);
      }
      return;
    }
    infinityActive.value = 0;
    // Map the touch back through the compressed value range.
    const x = Math.max(0, Math.min(1, xfull / mainFrac));
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
  };

  const gesture = Gesture.Pan()
    .minDistance(0)
    .onBegin((e) => {
      'worklet';
      isDragging.value = true;
      snapToTouch(e.x);
    })
    .onUpdate((e) => {
      'worklet';
      snapToTouch(e.x);
    })
    .onFinalize(() => {
      'worklet';
      isDragging.value = false;
      // Final-only store write — keeps the dragging path off any
      // selector that fans out re-renders. JS-thread no-op if caller
      // doesn't pass onRelease.
      if (onRelease) {
        runOnJS(onRelease)(lastSnap.value);
      }
    });

  const onLayout = useCallback((e: LayoutChangeEvent) => {
    const w = e.nativeEvent.layout.width;
    setMeasuredWidth(w);
    const t = w - pad * 2;
    requestAnimationFrame(() => {
      trackW.value = t;
      if (value !== undefined) {
        if (allowInfinity && value === OPEN_ENDED) {
          infinityActive.value = 1;
          internalProgress.value = 1;
        } else {
          infinityActive.value = 0;
          internalProgress.value = valueToPos(value, maxMinutes, bp);
        }
      }
    });
  }, [value, maxMinutes, allowInfinity]);

  // Sync external value changes (interactive mode)
  useEffect(() => {
    if (!isInteractive || width <= 0) return;
    requestAnimationFrame(() => {
      if (isDragging.value) return;
      if (lastSnap.value !== value) {
        if (allowInfinity && value === OPEN_ENDED) {
          infinityActive.value = 1;
          internalProgress.value = 1;
        } else {
          infinityActive.value = 0;
          internalProgress.value = valueToPos(value!, maxMinutes, bp);
        }
        lastSnap.value = value!;
        setDisplayMins(value!);
      }
    });
  }, [value, width]);

  // --- Animated props (UI thread) ---
  // Value progress is compressed into `mainFrac` of the track; ∞ parks the
  // thumb on the last stop at `infStopX` and runs the fill out to meet it.
  const fillProps = useAnimatedProps(() => {
    const vtw = fixedWidth ? fixedWidth - pad * 2 : trackW.value;
    return { x2: infinityActive.value ? infStopX : pad + progress.value * mainFrac * vtw };
  });

  const thumbProps = useAnimatedProps(() => {
    const vtw = fixedWidth ? fixedWidth - pad * 2 : trackW.value;
    return { cx: infinityActive.value ? infStopX : pad + progress.value * mainFrac * vtw };
  });

  const thumbDotProps = useAnimatedProps(() => {
    const vtw = fixedWidth ? fixedWidth - pad * 2 : trackW.value;
    return { cx: infinityActive.value ? infStopX : pad + progress.value * mainFrac * vtw };
  });

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
        {/* Track — one continuous line; the empty span between the last number
            and ∞ is the gap, ∞ being the final stop near the right end. */}
        <SvgLine
          x1={pad} y1={cy} x2={width - pad} y2={cy}
          stroke={trackBgColor ?? theme.textTertiary}
          strokeWidth={bgSW}
          strokeLinecap="round"
        />
        {/* Tick marks — interactive ticks animate via the UI-thread
            `lastSnap` so fill updates land on the same frame as the
            thumb, without waiting for the store roundtrip. */}
        {ticks.map((m) => {
          const tx = pad + (isInteractive ? valueToPos(m, maxMinutes, bp) * mainFrac : m / maxMinutes) * tw;
          if (!isInteractive) {
            return (
              <SvgLine
                key={m}
                x1={tx} y1={cy - 4} x2={tx} y2={cy + 4}
                stroke={trackBgColor ?? theme.textTertiary}
                strokeWidth={1.5}
              />
            );
          }
          return (
            <AnimatedTick
              key={m}
              tx={tx}
              cy={cy}
              threshold={m}
              activeColor={color}
              inactiveColor={trackBgColor ?? theme.textTertiary ?? color}
              lastSnap={lastSnap}
              infinityActive={infinityActive}
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
                  left: pad + pos * mainFrac * tw,
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
          {/* ∞ sits in the scale row, aligned with the numbers, above its stop. */}
          {allowInfinity && (
            <View
              style={{
                position: 'absolute',
                left: infStopX,
                top: -3, // nudge the taller ∞ glyph to sit level with the numbers
                alignItems: 'center',
                transform: [{ translateX: -14 }],
                width: 28,
              }}
            >
              <Text
                style={[
                  styles.scaleLabel,
                  { color: theme.textTertiary },
                  scaleLabelStyle,
                  { fontSize: 22, lineHeight: 22, fontWeight: '300' },
                  displayMins === OPEN_ENDED && { color },
                ]}
              >
                ∞
              </Text>
            </View>
          )}
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
