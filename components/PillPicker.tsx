import { useEffect, useRef, useState } from 'react';
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
  interpolateColor,
  useAnimatedScrollHandler,
  useAnimatedStyle,
  useSharedValue,
  type SharedValue,
} from 'react-native-reanimated';
import { NativeViewGestureHandler } from 'react-native-gesture-handler';
import * as Haptics from 'expo-haptics';
import { LinearGradient } from 'expo-linear-gradient';

import { Fonts } from '@/constants/theme';
import type { AppTheme } from '@/lib/theme';

const AnimatedScrollView = Animated.createAnimatedComponent(ScrollView);
const AnimatedText = Animated.createAnimatedComponent(Text);

const ITEM_WIDTH = 180;
const PICKER_HEIGHT = 100;
const ACTIVE_X = 24;
const RIGHT_FADE_WIDTH = 56;
const RIGHT_PAD_EXTRA = 32;

const FONT_ACTIVE = 34;
const FONT_BASE = 18;
const OPACITY_BASE = 0.55;
const DESCENDER_RATIO = 0.13;
const TEXT_BOTTOM_OFFSET = 28;

export interface PillPickerItem<T extends string | null> {
  id: T;
  name: string;
}

interface Props<T extends string | null> {
  items: PillPickerItem<T>[];
  selectedId: T;
  onSelect: (id: T) => void;
  theme: AppTheme;
}

export default function PillPicker<T extends string | null>({
  items,
  selectedId,
  onSelect,
  theme,
}: Props<T>) {
  const [viewportW, setViewportW] = useState(0);
  const scrollX = useSharedValue(0);
  const scrollRef = useRef<ScrollView>(null);
  const lastSelectedIndex = useRef<number>(-1);
  const initializedRef = useRef(false);

  const selectedIndex = Math.max(0, items.findIndex((it) => it.id === selectedId));

  const onLayout = (e: LayoutChangeEvent) => {
    const w = e.nativeEvent.layout.width;
    if (w !== viewportW) setViewportW(w);
  };

  useEffect(() => {
    if (viewportW === 0) return;
    if (!initializedRef.current) {
      initializedRef.current = true;
      scrollRef.current?.scrollTo({ x: selectedIndex * ITEM_WIDTH, animated: false });
      lastSelectedIndex.current = selectedIndex;
      scrollX.value = selectedIndex * ITEM_WIDTH;
      return;
    }
    if (selectedIndex !== lastSelectedIndex.current) {
      lastSelectedIndex.current = selectedIndex;
      scrollRef.current?.scrollTo({ x: selectedIndex * ITEM_WIDTH, animated: true });
    }
  }, [viewportW, selectedIndex, scrollX]);

  const scrollHandler = useAnimatedScrollHandler({
    onScroll: (e) => {
      scrollX.value = e.contentOffset.x;
    },
  });

  const handleMomentumEnd = (e: NativeSyntheticEvent<NativeScrollEvent>) => {
    const x = e.nativeEvent.contentOffset.x;
    const idx = Math.max(0, Math.min(items.length - 1, Math.round(x / ITEM_WIDTH)));
    if (idx !== lastSelectedIndex.current) {
      lastSelectedIndex.current = idx;
      Haptics.selectionAsync();
      onSelect(items[idx].id);
    }
  };

  const paddingRight = viewportW > 0 ? Math.max(0, viewportW - ACTIVE_X - ITEM_WIDTH) + RIGHT_PAD_EXTRA : 0;

  return (
    <View onLayout={onLayout} style={styles.container}>
      {viewportW > 0 && (
        <>
          <NativeViewGestureHandler disallowInterruption>
            <AnimatedScrollView
              ref={scrollRef}
              horizontal
              showsHorizontalScrollIndicator={false}
              snapToInterval={ITEM_WIDTH}
              decelerationRate="fast"
              contentContainerStyle={{ paddingLeft: ACTIVE_X, paddingRight }}
              onScroll={scrollHandler}
              onMomentumScrollEnd={handleMomentumEnd}
              scrollEventThrottle={16}
            >
              {items.map((item, i) => (
                <PillItem
                  key={item.id ?? '__null'}
                  name={item.name}
                  index={i}
                  scrollX={scrollX}
                  theme={theme}
                  onPress={() => {
                    scrollRef.current?.scrollTo({ x: i * ITEM_WIDTH, animated: true });
                  }}
                />
              ))}
            </AnimatedScrollView>
          </NativeViewGestureHandler>

          <LinearGradient
            pointerEvents="none"
            colors={[`${theme.bg}00`, theme.bg]}
            start={{ x: 0, y: 0.5 }}
            end={{ x: 1, y: 0.5 }}
            style={[styles.fade, { right: 0, width: RIGHT_FADE_WIDTH }]}
          />
        </>
      )}
    </View>
  );
}

interface PillItemProps {
  name: string;
  index: number;
  scrollX: SharedValue<number>;
  theme: AppTheme;
  onPress: () => void;
}

function PillItem({ name, index, scrollX, theme, onPress }: PillItemProps) {
  const animatedStyle = useAnimatedStyle(() => {
    const distance = Math.abs(scrollX.value - index * ITEM_WIDTH);
    const t = Math.min(1, distance / ITEM_WIDTH);
    const fontSize = FONT_ACTIVE + (FONT_BASE - FONT_ACTIVE) * t;
    const opacity = interpolate(t, [0, 1], [1, OPACITY_BASE], 'clamp');
    const color = interpolateColor(t, [0, 1], [theme.accent, theme.text]);
    const bottom = TEXT_BOTTOM_OFFSET - DESCENDER_RATIO * fontSize;
    const lineHeight = fontSize;
    return { fontSize, opacity, color, bottom, lineHeight };
  });

  return (
    <Pressable onPress={onPress} style={styles.slot}>
      <AnimatedText
        numberOfLines={1}
        ellipsizeMode="tail"
        style={[styles.itemLabel, { fontFamily: Fonts!.serif }, animatedStyle]}
      >
        {name}
      </AnimatedText>
    </Pressable>
  );
}

const styles = StyleSheet.create({
  container: {
    width: '100%',
    height: PICKER_HEIGHT,
  },
  slot: {
    width: ITEM_WIDTH,
    height: PICKER_HEIGHT,
    position: 'relative',
  },
  itemLabel: {
    position: 'absolute',
    left: 0,
    right: 0,
    fontWeight: '400',
    letterSpacing: 0.2,
    textAlign: 'left',
    includeFontPadding: false,
  },
  fade: {
    position: 'absolute',
    top: 0,
    bottom: 0,
  },
});
