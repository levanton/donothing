import BottomSheet, {
  type BottomSheetBackdropProps,
  BottomSheetView,
} from '@gorhom/bottom-sheet';
import * as Haptics from 'expo-haptics';
import { forwardRef, useCallback, useImperativeHandle, useRef } from 'react';
import { Pressable, StyleSheet, Text, View } from 'react-native';
import Svg, { Path } from 'react-native-svg';
import Animated, {
  Extrapolation,
  interpolate,
  useAnimatedStyle,
} from 'react-native-reanimated';
import { useSafeAreaInsets } from 'react-native-safe-area-context';

import { Fonts } from '@/constants/theme';
import { palette, type AppTheme } from '@/lib/theme';

interface Props {
  theme: AppTheme;
  onStartAgain: () => void;
  onClose?: () => void;
}

// Soft terracotta backdrop that matches BlockSheet's design language —
// the same warm "you've left the running screen" wash, just simpler
// (no mountain image; this sheet is shorter so the focal point is the
// Enso itself).
function TerracottaBackdrop({ animatedIndex }: BottomSheetBackdropProps) {
  const animatedStyle = useAnimatedStyle(() => ({
    opacity: interpolate(
      animatedIndex.value,
      [-1, 0],
      [0, 1],
      Extrapolation.CLAMP,
    ),
  }));
  return (
    <Animated.View
      pointerEvents="auto"
      style={[
        StyleSheet.absoluteFillObject,
        { backgroundColor: palette.terracotta },
        animatedStyle,
      ]}
    />
  );
}

// Open zen circle — preserved from the previous full-screen
// SessionEndedView so the calligraphic symbol carries through the
// redesign even though everything around it is new.
function Enso({ color, size = 88 }: { color: string; size?: number }) {
  const r = size / 2 - 3;
  const cx = size / 2;
  const cy = size / 2;
  const startAngle = (20 * Math.PI) / 180;
  const endAngle = (320 * Math.PI) / 180;
  const x1 = cx + r * Math.cos(startAngle);
  const y1 = cy + r * Math.sin(startAngle);
  const x2 = cx + r * Math.cos(endAngle);
  const y2 = cy + r * Math.sin(endAngle);
  const d = `M ${x1} ${y1} A ${r} ${r} 0 1 1 ${x2} ${y2}`;
  return (
    <Svg width={size} height={size} style={{ transform: [{ rotate: '-30deg' }] }}>
      <Path d={d} stroke={color} strokeWidth={2} strokeLinecap="round" fill="none" />
    </Svg>
  );
}

const SessionEndedSheet = forwardRef<BottomSheet, Props>(
  ({ theme, onStartAgain, onClose }, ref) => {
    const insets = useSafeAreaInsets();
    const internalRef = useRef<BottomSheet>(null);
    useImperativeHandle(ref, () => internalRef.current as BottomSheet, []);

    const handleStart = useCallback(() => {
      Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Medium).catch(() => {});
      onStartAgain();
    }, [onStartAgain]);

    return (
      <BottomSheet
        ref={internalRef}
        index={-1}
        enableDynamicSizing
        enablePanDownToClose={false}
        enableOverDrag={false}
        enableHandlePanningGesture={false}
        enableContentPanningGesture={false}
        backdropComponent={TerracottaBackdrop}
        handleComponent={null}
        backgroundStyle={{
          backgroundColor: theme.bg,
          borderTopLeftRadius: 36,
          borderTopRightRadius: 36,
        }}
        onChange={(i) => {
          if (i === -1) onClose?.();
        }}
      >
        <BottomSheetView
          style={[styles.body, { paddingBottom: insets.bottom + 28 }]}
        >
          {/* Eyebrow pill — uppercase serif on warm sand chip,
              matching BlockSheet's eyebrow exactly. */}
          <View style={styles.eyebrowRow}>
            <View style={[styles.eyebrowPill, { backgroundColor: CHIP_LIGHT }]}>
              <Text
                style={[
                  styles.eyebrowText,
                  { color: BROWN, fontFamily: Fonts!.serif },
                ]}
              >
                session interrupted
              </Text>
            </View>
          </View>

          {/* Starscape hero — scattered dots around the Enso, same
              vocabulary as BlockSheet's "20 min" hero. */}
          <View style={styles.starscape}>
            <View
              style={[
                styles.star,
                { top: 4, left: 30, width: 3, height: 3, backgroundColor: theme.text, opacity: 0.5 },
              ]}
            />
            <View
              style={[
                styles.star,
                { top: 22, left: 70, width: 5, height: 5, backgroundColor: TERRACOTTA },
              ]}
            />
            <View
              style={[
                styles.star,
                { top: 40, left: 10, width: 4, height: 4, backgroundColor: theme.text, opacity: 0.35 },
              ]}
            />
            <View
              style={[
                styles.star,
                { top: 12, right: 36, width: 4, height: 4, backgroundColor: theme.text, opacity: 0.7 },
              ]}
            />
            <View
              style={[
                styles.star,
                { top: 50, right: 18, width: 3, height: 3, backgroundColor: TERRACOTTA, opacity: 0.8 },
              ]}
            />
            <View
              style={[
                styles.star,
                { bottom: 18, left: 38, width: 5, height: 5, backgroundColor: theme.text, opacity: 0.4 },
              ]}
            />
            <View
              style={[
                styles.star,
                { bottom: 32, right: 52, width: 3, height: 3, backgroundColor: TERRACOTTA, opacity: 0.6 },
              ]}
            />
            <View
              style={[
                styles.star,
                { bottom: 6, right: 24, width: 4, height: 4, backgroundColor: theme.text, opacity: 0.5 },
              ]}
            />

            <Enso color={theme.text} size={88} />

            <Text
              style={[
                styles.heroCaption,
                { color: theme.text, fontFamily: Fonts!.serif },
              ]}
            >
              you stepped away
            </Text>
            <Text
              style={[
                styles.heroSub,
                { color: theme.textTertiary, fontFamily: Fonts!.serif },
              ]}
            >
              ready when you are
            </Text>
          </View>

          <View
            style={[styles.heroSubRule, { backgroundColor: theme.border }]}
          />

          {/* Primary CTA — solid terracotta pill, cream text. Mirrors
              BlockSheet's "do nothing" button so the visual rhythm is
              consistent across the two recoverable-state sheets. */}
          <Pressable
            onPress={handleStart}
            style={({ pressed }) => [
              styles.primaryBtn,
              pressed && styles.primaryBtnPressed,
            ]}
            hitSlop={8}
          >
            <Text style={[styles.primaryText, { fontFamily: Fonts!.serif }]}>
              start again
            </Text>
          </Pressable>
        </BottomSheetView>
      </BottomSheet>
    );
  },
);

SessionEndedSheet.displayName = 'SessionEndedSheet';
export default SessionEndedSheet;

const CREAM = palette.cream;
const BROWN = palette.brown;
const TERRACOTTA = palette.terracotta;
const CHIP_LIGHT = '#EBDAB2';

const styles = StyleSheet.create({
  body: {
    paddingHorizontal: 28,
    paddingTop: 28,
    alignItems: 'center',
  },
  eyebrowRow: {
    flexDirection: 'row',
    justifyContent: 'center',
    marginBottom: 8,
  },
  eyebrowPill: {
    paddingHorizontal: 12,
    paddingVertical: 6,
    borderRadius: 100,
  },
  eyebrowText: {
    fontSize: 11,
    fontWeight: '700',
    letterSpacing: 2,
    textTransform: 'uppercase',
  },
  starscape: {
    alignSelf: 'stretch',
    alignItems: 'center',
    paddingTop: 24,
    paddingBottom: 0,
    paddingHorizontal: 8,
    position: 'relative',
  },
  star: {
    position: 'absolute',
    borderRadius: 100,
  },
  heroCaption: {
    fontSize: 18,
    fontWeight: '500',
    letterSpacing: 0.4,
    marginTop: 18,
  },
  heroSub: {
    fontSize: 13,
    fontWeight: '400',
    letterSpacing: 0.3,
    marginTop: 4,
  },
  heroSubRule: {
    width: 28,
    height: 1.5,
    borderRadius: 1,
    alignSelf: 'center',
    marginVertical: 18,
  },
  primaryBtn: {
    alignSelf: 'stretch',
    backgroundColor: TERRACOTTA,
    borderRadius: 100,
    paddingVertical: 20,
    alignItems: 'center',
    justifyContent: 'center',
    marginBottom: 6,
  },
  primaryBtnPressed: {
    opacity: 0.92,
    transform: [{ scale: 0.99 }],
  },
  primaryText: {
    color: CREAM,
    fontSize: 19,
    fontWeight: '600',
    letterSpacing: 0.6,
  },
});
