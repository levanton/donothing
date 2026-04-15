import { useCallback, useEffect, useRef, useState } from 'react';
import {
  LayoutChangeEvent,
  StyleSheet,
  Text,
  View,
} from 'react-native';
import Animated, {
  Easing,
  interpolate,
  interpolateColor,
  runOnJS,
  useAnimatedReaction,
  useAnimatedStyle,
  useDerivedValue,
  useSharedValue,
  withTiming,
  type SharedValue,
} from 'react-native-reanimated';
import { Gesture, GestureDetector } from 'react-native-gesture-handler';
import * as Haptics from 'expo-haptics';
import { LinearGradient } from 'expo-linear-gradient';

import { Fonts } from '@/constants/theme';
import type { AppTheme } from '@/lib/theme';

const AnimatedText = Animated.createAnimatedComponent(Text);

const DEFAULT_OPTIONS = Array.from({ length: 90 }, (_, i) => i + 1);
const WHEEL_HEIGHT = 150;
const ACTIVE_X = 24;
const RIGHT_FADE_WIDTH = 56;
const PIXELS_PER_INDEX = 60;
const GAP = 12;
const TEXT_BOTTOM_OFFSET = 24;
const DESCENDER_RATIO = 0.13;

const FONT_ACTIVE = 100;
const FONT_BASE = 36;
const OPACITY_ACTIVE = 1;
const OPACITY_BASE = 0.55;

// Approximate per-em width factor for our serif tabular numerals — kept on
// the high side so layout reserves enough room and active numbers never
// clip past the left edge.
const DIGIT_WIDTH_RATIO = 0.65;

function fontSizeForDist(d: number) {
  'worklet';
  if (d >= 1) return FONT_BASE;
  return FONT_ACTIVE + (FONT_BASE - FONT_ACTIVE) * d;
}

function opacityForDist(d: number) {
  'worklet';
  if (d >= 1) return OPACITY_BASE;
  return OPACITY_ACTIVE + (OPACITY_BASE - OPACITY_ACTIVE) * d;
}

function widthOf(value: number, fontSize: number) {
  'worklet';
  const digits = value < 10 ? 1 : value < 100 ? 2 : 3;
  return digits * fontSize * DIGIT_WIDTH_RATIO;
}

interface Props {
  value: number;
  onChange: (value: number) => void;
  theme: AppTheme;
  options?: number[];
  unitLabel?: string;
}

export default function GoalWheel({
  value,
  onChange,
  theme,
  options = DEFAULT_OPTIONS,
  unitLabel = 'min',
}: Props) {
  const [viewportW, setViewportW] = useState(0);
  const activeIdx = useSharedValue(0);
  const dragStart = useSharedValue(0);
  const lastSnap = useRef<number>(-1);
  const initializedRef = useRef(false);

  const findNearestIndex = useCallback(
    (v: number) => {
      let best = 0;
      let bestDiff = Infinity;
      for (let i = 0; i < options.length; i++) {
        const d = Math.abs(options[i] - v);
        if (d < bestDiff) {
          best = i;
          bestDiff = d;
        }
      }
      return best;
    },
    [options],
  );

  useEffect(() => {
    const idx = findNearestIndex(value);
    if (!initializedRef.current) {
      initializedRef.current = true;
      activeIdx.value = idx;
      lastSnap.current = idx;
      return;
    }
    if (idx !== lastSnap.current) {
      lastSnap.current = idx;
      activeIdx.value = withTiming(idx, { duration: 320, easing: Easing.bezier(0.22, 1, 0.36, 1) });
    }
  }, [value, findNearestIndex, activeIdx]);

  // Compute every item's center X position from the current active fractional
  // index. Items left and right of active are placed by accumulating
  // (width + GAP), so visible gaps stay uniform regardless of font sizes.
  const centers = useDerivedValue(() => {
    const ai = activeIdx.value;
    const N = options.length;
    const result: number[] = new Array(N);
    const activeFloor = Math.floor(ai);
    const t = ai - activeFloor;
    const activeCeil = Math.min(activeFloor + 1, N - 1);

    const widthAt = (i: number) => {
      const d = Math.abs(i - ai);
      const fs = fontSizeForDist(d);
      return widthOf(options[i], fs);
    };

    const wFloor = widthAt(activeFloor);
    // Anchor: activeFloor's LEFT edge sits at ACTIVE_X when snapped (t=0).
    const floorCenter = ACTIVE_X + wFloor / 2;

    result[activeFloor] = floorCenter;
    // Walk right
    let prevRight = floorCenter + wFloor / 2;
    for (let i = activeFloor + 1; i < N; i++) {
      const w = widthAt(i);
      result[i] = prevRight + GAP + w / 2;
      prevRight = result[i] + w / 2;
    }
    // Walk left
    let prevLeft = floorCenter - wFloor / 2;
    for (let i = activeFloor - 1; i >= 0; i--) {
      const w = widthAt(i);
      result[i] = prevLeft - GAP - w / 2;
      prevLeft = result[i] - w / 2;
    }

    // During fractional active, slide everything left so the "visual active
    // left edge" stays anchored at ACTIVE_X as it transitions from
    // activeFloor to activeFloor+1.
    const shift = -t * (wFloor + GAP);
    for (let i = 0; i < N; i++) result[i] += shift;
    return result;
  });

  // Haptic on every integer index crossed
  useAnimatedReaction(
    () => Math.round(activeIdx.value),
    (curr, prev) => {
      if (prev !== null && curr !== prev) {
        runOnJS(Haptics.selectionAsync)();
      }
    },
  );

  const commit = useCallback(
    (idx: number) => {
      lastSnap.current = idx;
      onChange(options[idx]);
    },
    [onChange, options],
  );

  const gesture = Gesture.Pan()
    .activeOffsetX([-3, 3])
    .failOffsetY([-12, 12])
    .onStart(() => {
      'worklet';
      dragStart.value = activeIdx.value;
    })
    .onUpdate((e) => {
      'worklet';
      let next = dragStart.value - e.translationX / PIXELS_PER_INDEX;
      if (next < 0) next = 0;
      if (next > options.length - 1) next = options.length - 1;
      activeIdx.value = next;
    })
    .onEnd((e) => {
      'worklet';
      const projected = activeIdx.value - (e.velocityX / PIXELS_PER_INDEX) * 0.25;
      let target = Math.round(projected);
      if (target < 0) target = 0;
      if (target > options.length - 1) target = options.length - 1;
      activeIdx.value = withTiming(target, { duration: 320, easing: Easing.bezier(0.22, 1, 0.36, 1) });
      runOnJS(commit)(target);
    });

  const onLayout = (e: LayoutChangeEvent) => {
    const w = e.nativeEvent.layout.width;
    if (w !== viewportW) setViewportW(w);
  };

  return (
    <View onLayout={onLayout} style={styles.container}>
      <GestureDetector gesture={gesture}>
        <View style={StyleSheet.absoluteFill}>
          {options.map((n, i) => (
            <WheelItem
              key={n}
              value={n}
              index={i}
              centers={centers}
              activeIdx={activeIdx}
              theme={theme}
            />
          ))}
        </View>
      </GestureDetector>

      <LinearGradient
        pointerEvents="none"
        colors={[`${theme.bg}00`, theme.bg]}
        start={{ x: 0, y: 0.5 }}
        end={{ x: 1, y: 0.5 }}
        style={[styles.fade, { right: 0, width: RIGHT_FADE_WIDTH }]}
      />

      <UnitLabel
        label={unitLabel}
        theme={theme}
        activeIdx={activeIdx}
        options={options}
      />
    </View>
  );
}

interface UnitLabelProps {
  label: string;
  theme: AppTheme;
  activeIdx: SharedValue<number>;
  options: number[];
}

const UNIT_W = 80;

function UnitLabel({ label, theme, activeIdx, options }: UnitLabelProps) {
  const animatedStyle = useAnimatedStyle(() => {
    const ai = activeIdx.value;
    const floor = Math.floor(ai);
    const ceil = Math.min(floor + 1, options.length - 1);
    const t = ai - floor;
    const wFloor = widthOf(options[floor], FONT_ACTIVE);
    const wCeil = widthOf(options[ceil], FONT_ACTIVE);
    const w = wFloor + (wCeil - wFloor) * t;
    // Active item's LEFT edge is anchored at ACTIVE_X, so its center is
    // ACTIVE_X + w/2. Center the unit container under that.
    const center = ACTIVE_X + w / 2;
    return { left: center - UNIT_W / 2 };
  });

  return (
    <Animated.View
      pointerEvents="none"
      style={[styles.unitContainer, animatedStyle]}
    >
      <Text
        style={[
          styles.unit,
          { color: theme.textSecondary, fontFamily: Fonts!.serif },
        ]}
      >
        {label}
      </Text>
    </Animated.View>
  );
}

interface WheelItemProps {
  value: number;
  index: number;
  centers: SharedValue<number[]>;
  activeIdx: SharedValue<number>;
  theme: AppTheme;
}

function WheelItem({ value, index, centers, activeIdx, theme }: WheelItemProps) {
  const animatedStyle = useAnimatedStyle(() => {
    const dist = Math.abs(index - activeIdx.value);
    const fontSize = fontSizeForDist(dist);
    const opacity = opacityForDist(dist);
    const w = widthOf(value, fontSize);
    const center = centers.value[index] ?? -9999;
    const left = center - w / 2;
    const bottom = TEXT_BOTTOM_OFFSET - DESCENDER_RATIO * fontSize;
    const lineHeight = fontSize;
    const color = interpolateColor(
      dist,
      [0, 1, 2],
      [theme.accent, theme.text, theme.text],
    );
    return {
      left,
      bottom,
      width: Math.ceil(w) + 4,
      fontSize,
      lineHeight,
      opacity,
      color,
    };
  });

  return (
    <AnimatedText
      numberOfLines={1}
      style={[
        styles.number,
        { fontFamily: Fonts!.serif },
        animatedStyle,
      ]}
    >
      {value}
    </AnimatedText>
  );
}

const styles = StyleSheet.create({
  container: {
    width: '100%',
    height: WHEEL_HEIGHT,
    overflow: 'hidden',
  },
  number: {
    position: 'absolute',
    fontWeight: '300',
    letterSpacing: -1,
    fontVariant: ['tabular-nums'],
    textAlign: 'center',
    includeFontPadding: false,
  },
  fade: {
    position: 'absolute',
    top: 0,
    bottom: 0,
  },
  unitContainer: {
    position: 'absolute',
    bottom: 6,
    width: UNIT_W,
    alignItems: 'center',
  },
  unit: {
    fontSize: 13,
    fontWeight: '300',
    fontStyle: 'italic',
    letterSpacing: 0.5,
  },
});
