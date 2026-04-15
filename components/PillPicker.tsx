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

const ITEM_WIDTH = 160;
const PICKER_HEIGHT = 72;
const FADE_WIDTH = 56;

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

  const pad = viewportW > 0 ? (viewportW - ITEM_WIDTH) / 2 : 0;

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
            contentContainerStyle={{ paddingHorizontal: pad }}
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

          <LinearGradient
            pointerEvents="none"
            colors={[theme.bg, `${theme.bg}00`]}
            start={{ x: 0, y: 0.5 }}
            end={{ x: 1, y: 0.5 }}
            style={[styles.fade, { left: 0, width: FADE_WIDTH }]}
          />
          <LinearGradient
            pointerEvents="none"
            colors={[`${theme.bg}00`, theme.bg]}
            start={{ x: 0, y: 0.5 }}
            end={{ x: 1, y: 0.5 }}
            style={[styles.fade, { right: 0, width: FADE_WIDTH }]}
          />

          <View pointerEvents="none" style={styles.indicatorWrap}>
            <View style={[styles.indicatorLine, { backgroundColor: theme.accent }]} />
          </View>
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
    const scale = interpolate(distance, [0, ITEM_WIDTH], [1, 0.78], 'clamp');
    const opacity = interpolate(distance, [0, ITEM_WIDTH], [1, 0.55], 'clamp');
    return {
      transform: [{ scale }],
      opacity,
    };
  });

  return (
    <Pressable onPress={onPress} style={styles.slot}>
      <Animated.View style={[styles.item, animatedStyle]}>
        <Text
          style={[styles.itemLabel, { color: theme.text, fontFamily: Fonts!.serif }]}
          numberOfLines={1}
          ellipsizeMode="tail"
        >
          {name}
        </Text>
      </Animated.View>
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
    alignItems: 'center',
    justifyContent: 'center',
  },
  item: {
    paddingHorizontal: 12,
    justifyContent: 'center',
    alignItems: 'center',
  },
  itemLabel: {
    fontSize: 26,
    fontWeight: '400',
    letterSpacing: 0.2,
  },
  fade: {
    position: 'absolute',
    top: 0,
    bottom: 0,
  },
  indicatorWrap: {
    position: 'absolute',
    bottom: 8,
    left: 0,
    right: 0,
    alignItems: 'center',
  },
  indicatorLine: {
    width: 16,
    height: 2,
    borderRadius: 1,
  },
});
