import { useEffect, useMemo, useRef, useState } from 'react';
import {
  LayoutChangeEvent,
  NativeScrollEvent,
  NativeSyntheticEvent,
  Pressable,
  ScrollView,
  StyleSheet,
  Text,
  View,
} from 'react-native';
import Animated, {
  interpolate,
  runOnJS,
  useAnimatedReaction,
  useAnimatedScrollHandler,
  useAnimatedStyle,
  useSharedValue,
  type SharedValue,
} from 'react-native-reanimated';
import * as Haptics from 'expo-haptics';
import { LinearGradient } from 'expo-linear-gradient';

import { Fonts } from '@/constants/theme';
import type { AppTheme } from '@/lib/theme';

const AnimatedScrollView = Animated.createAnimatedComponent(ScrollView);
const AnimatedText = Animated.createAnimatedComponent(Text);

const DEFAULT_OPTIONS = Array.from({ length: 90 }, (_, i) => i + 1);
const ITEM_WIDTH = 96;
const WHEEL_HEIGHT = 140;
const ACTIVE_X = 16;
const RIGHT_PAD_EXTRA = 32;
const FADE_WIDTH = 56;
const FONT_ACTIVE = 88;
const FONT_FAR = 24;
const TEXT_BOTTOM_OFFSET = 24;

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
  const scrollX = useSharedValue(0);
  const scrollRef = useRef<ScrollView>(null);
  const lastIndex = useRef<number>(-1);
  const initializedRef = useRef(false);

  const nearestIndex = useMemo(() => {
    let best = 0;
    let bestDiff = Infinity;
    for (let i = 0; i < options.length; i++) {
      const d = Math.abs(options[i] - value);
      if (d < bestDiff) {
        best = i;
        bestDiff = d;
      }
    }
    return best;
  }, [options, value]);

  const onLayout = (e: LayoutChangeEvent) => {
    const w = e.nativeEvent.layout.width;
    if (w !== viewportW) setViewportW(w);
  };

  useEffect(() => {
    if (viewportW === 0) return;
    if (!initializedRef.current) {
      initializedRef.current = true;
      scrollRef.current?.scrollTo({ x: nearestIndex * ITEM_WIDTH, animated: false });
      scrollX.value = nearestIndex * ITEM_WIDTH;
      return;
    }
    if (nearestIndex !== lastIndex.current) {
      scrollRef.current?.scrollTo({ x: nearestIndex * ITEM_WIDTH, animated: true });
    }
  }, [viewportW, nearestIndex, scrollX]);

  const scrollHandler = useAnimatedScrollHandler({
    onScroll: (e) => {
      scrollX.value = e.contentOffset.x;
    },
  });

  useAnimatedReaction(
    () => Math.round(scrollX.value / ITEM_WIDTH),
    (curr, prev) => {
      if (prev !== null && curr !== prev) {
        runOnJS(Haptics.selectionAsync)();
      }
    },
  );

  const handleMomentumEnd = (e: NativeSyntheticEvent<NativeScrollEvent>) => {
    const x = e.nativeEvent.contentOffset.x;
    const idx = Math.max(0, Math.min(options.length - 1, Math.round(x / ITEM_WIDTH)));
    lastIndex.current = idx;
    onChange(options[idx]);
  };

  const paddingRight = viewportW > 0 ? Math.max(0, viewportW - ACTIVE_X - ITEM_WIDTH) + RIGHT_PAD_EXTRA : 0;

  return (
    <View onLayout={onLayout} style={styles.container}>
      {viewportW > 0 && (
        <>
          <AnimatedScrollView
            ref={scrollRef}
            horizontal
            showsHorizontalScrollIndicator={false}
            snapToInterval={ITEM_WIDTH}
            decelerationRate="fast"
            removeClippedSubviews
            contentContainerStyle={{
              paddingLeft: ACTIVE_X,
              paddingRight,
            }}
            onScroll={scrollHandler}
            onMomentumScrollEnd={handleMomentumEnd}
            scrollEventThrottle={16}
          >
            {options.map((n, i) => (
              <WheelItem
                key={n}
                value={n}
                index={i}
                scrollX={scrollX}
                theme={theme}
                onPress={() => {
                  scrollRef.current?.scrollTo({ x: i * ITEM_WIDTH, animated: true });
                }}
              />
            ))}
          </AnimatedScrollView>

          <LinearGradient
            pointerEvents="none"
            colors={[`${theme.bg}00`, theme.bg]}
            start={{ x: 0, y: 0.5 }}
            end={{ x: 1, y: 0.5 }}
            style={[styles.fade, { right: 0, width: FADE_WIDTH }]}
          />

          <Text
            pointerEvents="none"
            style={[
              styles.unit,
              {
                color: theme.textSecondary,
                fontFamily: Fonts!.serif,
                left: ACTIVE_X,
              },
            ]}
          >
            {unitLabel}
          </Text>
        </>
      )}
    </View>
  );
}

interface WheelItemProps {
  value: number;
  index: number;
  scrollX: SharedValue<number>;
  theme: AppTheme;
  onPress: () => void;
}

// Empirical descender ratio for the serif font — how much the rendered
// glyph bottom (baseline) sits ABOVE the Text element's bottom edge.
const DESCENDER_RATIO = 0.13;

function WheelItem({ value, index, scrollX, theme, onPress }: WheelItemProps) {
  const animatedTextStyle = useAnimatedStyle(() => {
    const distance = Math.abs(scrollX.value - index * ITEM_WIDTH);
    const fontSize = interpolate(
      distance,
      [0, ITEM_WIDTH, ITEM_WIDTH * 2, ITEM_WIDTH * 3],
      [FONT_ACTIVE, 44, 30, FONT_FAR],
      'clamp',
    );
    const opacity = interpolate(
      distance,
      [0, ITEM_WIDTH, ITEM_WIDTH * 2, ITEM_WIDTH * 3],
      [1, 0.85, 0.7, 0.55],
      'clamp',
    );
    // Drop the Text element so its baseline (not its bottom edge) sits at
    // a fixed Y across all font sizes.
    const bottom = TEXT_BOTTOM_OFFSET - DESCENDER_RATIO * fontSize;
    const lineHeight = fontSize;
    return { fontSize, lineHeight, opacity, bottom };
  });

  return (
    <Pressable onPress={onPress} style={styles.slot}>
      <AnimatedText
        style={[
          styles.number,
          { color: theme.text, fontFamily: Fonts!.serif },
          animatedTextStyle,
        ]}
      >
        {value}
      </AnimatedText>
    </Pressable>
  );
}

const styles = StyleSheet.create({
  container: {
    width: '100%',
    height: WHEEL_HEIGHT,
  },
  slot: {
    width: ITEM_WIDTH,
    height: WHEEL_HEIGHT,
    position: 'relative',
  },
  number: {
    position: 'absolute',
    bottom: TEXT_BOTTOM_OFFSET,
    left: 0,
    width: ITEM_WIDTH,
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
  unit: {
    position: 'absolute',
    bottom: 6,
    width: ITEM_WIDTH,
    fontSize: 13,
    fontWeight: '300',
    fontStyle: 'italic',
    letterSpacing: 0.5,
    textAlign: 'center',
  },
});
