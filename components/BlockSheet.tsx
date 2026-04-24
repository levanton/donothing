import { Feather } from '@expo/vector-icons';
import BottomSheet, {
  type BottomSheetBackdropProps,
  BottomSheetView,
} from '@gorhom/bottom-sheet';
import * as Haptics from 'expo-haptics';
import {
  forwardRef,
  useCallback,
  useImperativeHandle,
  useRef,
} from 'react';
import {
  Dimensions,
  Image,
  Pressable,
  StyleSheet,
  Text,
  View,
} from 'react-native';
import Animated, {
  Extrapolation,
  interpolate,
  useAnimatedStyle,
} from 'react-native-reanimated';
import { useSafeAreaInsets } from 'react-native-safe-area-context';

import { Fonts } from '@/constants/theme';
import { palette, type AppTheme } from '@/lib/theme';

const SCREEN_W = Dimensions.get('window').width;
const SCREEN_H = Dimensions.get('window').height;
const MOUNTAIN_SIZE = Math.min(Math.round(SCREEN_W * 0.62), 280);

const mountainImage = require('@/assets/images/mountain.png');

interface Props {
  theme: AppTheme;
  unlockMin: number;
  onStart: (minutes: number) => void;
  onUnlock: () => void;
  onClose?: () => void;
}

function TerracottaBackdrop({ animatedIndex }: BottomSheetBackdropProps) {
  const insets = useSafeAreaInsets();
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
      pointerEvents='auto'
      style={[
        StyleSheet.absoluteFillObject,
        { backgroundColor: palette.terracotta },
        animatedStyle,
      ]}
    >
      <View
        style={[
          styles.backdropImageWrap,
          { top: insets.top + SCREEN_H * 0.1 },
        ]}
        pointerEvents='none'
      >
        <Image
          source={mountainImage}
          style={styles.backdropImage}
          fadeDuration={0}
        />
      </View>
    </Animated.View>
  );
}

const BlockSheet = forwardRef<BottomSheet, Props>(
  ({ theme, unlockMin, onStart, onUnlock, onClose }, ref) => {
    const insets = useSafeAreaInsets();
    const internalRef = useRef<BottomSheet>(null);
    useImperativeHandle(ref, () => internalRef.current as BottomSheet, []);

    const handleBegin = useCallback(() => {
      Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Medium).catch(() => {});
      onStart(unlockMin);
    }, [onStart, unlockMin]);

    const handleUnlockPress = useCallback(() => {
      Haptics.notificationAsync(
        Haptics.NotificationFeedbackType.Warning,
      ).catch(() => {});
      onUnlock();
    }, [onUnlock]);

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
          {/* Top tag */}
          <View style={styles.topRow}>
            <View style={styles.chip}>
              <View style={styles.chipDot} />
              <Text
                style={[
                  styles.chipText,
                  { color: theme.text, fontFamily: Fonts!.serif },
                ]}
              >
                apps paused
              </Text>
            </View>
          </View>

          {/* Number block — centered */}
          <View style={styles.titleBlock}>
            <Text style={[styles.bigNumber, { color: theme.text }]}>
              {unlockMin}
            </Text>
            <Text
              style={[
                styles.unitText,
                { color: theme.text, fontFamily: Fonts!.serif },
              ]}
            >
              {unlockMin === 1 ? 'minute' : 'mins'}
            </Text>
            <View style={styles.unitDash} />
            <Text
              style={[
                styles.subText,
                { color: theme.textSecondary, fontFamily: Fonts!.serif },
              ]}
            >
              of doing nothing
            </Text>
          </View>

          {/* Benefits row — 3 colored micro-chips */}
          <View style={styles.benefitsRow}>
            <View style={[styles.benefitChip, { backgroundColor: WARM_CREAM }]}>
              <Feather name='moon' size={13} color={BROWN} />
              <Text
                style={[
                  styles.benefitText,
                  { color: BROWN, fontFamily: Fonts!.serif },
                ]}
              >
                rest
              </Text>
            </View>
            <View style={[styles.benefitChip, { backgroundColor: GOLD }]}>
              <Feather name='heart' size={13} color={WINE} />
              <Text
                style={[
                  styles.benefitText,
                  { color: WINE, fontFamily: Fonts!.serif },
                ]}
              >
                calm
              </Text>
            </View>
            <View style={[styles.benefitChip, { backgroundColor: WINE }]}>
              <Feather name='zap' size={13} color={CREAM} />
              <Text
                style={[
                  styles.benefitText,
                  { color: CREAM, fontFamily: Fonts!.serif },
                ]}
              >
                focus
              </Text>
            </View>
          </View>

          {/* Action row — unlock left, primary right */}
          <View style={styles.actionsRow}>
            <Pressable
              onPress={handleUnlockPress}
              style={({ pressed }) => [
                styles.unlockBtn,
                pressed && { opacity: 0.7 },
              ]}
              hitSlop={12}
            >
              <Text
                style={[
                  styles.unlockText,
                  { color: theme.text, fontFamily: Fonts!.serif },
                ]}
              >
                unlock now
              </Text>
            </Pressable>

            <Pressable
              onPress={handleBegin}
              style={({ pressed }) => [
                styles.primaryBtn,
                pressed && { opacity: 0.88 },
              ]}
              hitSlop={8}
            >
              <Text style={[styles.primaryText, { fontFamily: Fonts!.serif }]}>
                let's begin
              </Text>
              <Feather name='arrow-right' size={18} color={CREAM} />
            </Pressable>
          </View>
        </BottomSheetView>
      </BottomSheet>
    );
  },
);

BlockSheet.displayName = 'BlockSheet';
export default BlockSheet;

const CREAM = palette.cream;
const BROWN = palette.brown;
const TERRACOTTA = palette.terracotta;
const TERRACOTTA_SOFT = 'rgba(223, 92, 68, 0.18)';
// Warm-earth palette borrowed from SessionCompleteScreen benefits
const WARM_CREAM = '#F0E0BD';
const GOLD = '#C5A572';
const WINE = '#5C2F2F';

const styles = StyleSheet.create({
  backdropImageWrap: {
    position: 'absolute',
    left: 0,
    right: 0,
    alignItems: 'center',
  },
  backdropImage: {
    width: MOUNTAIN_SIZE,
    height: MOUNTAIN_SIZE,
    resizeMode: 'contain',
  },
  body: {
    paddingHorizontal: 28,
    paddingTop: 24,
    alignItems: 'center',
  },
  topRow: {
    marginBottom: 22,
  },
  chip: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
    backgroundColor: TERRACOTTA_SOFT,
    paddingHorizontal: 14,
    paddingVertical: 7,
    borderRadius: 100,
    overflow: 'hidden',
  },
  chipDot: {
    width: 6,
    height: 6,
    borderRadius: 3,
    backgroundColor: TERRACOTTA,
  },
  chipText: {
    fontSize: 12,
    fontWeight: '700',
    letterSpacing: 1.6,
    textTransform: 'uppercase',
  },
  titleBlock: {
    alignItems: 'center',
    marginBottom: 26,
  },
  bigNumber: {
    fontSize: 96,
    fontFamily: Fonts!.mono,
    fontVariant: ['tabular-nums'],
    fontWeight: '700',
    letterSpacing: -1,
    lineHeight: 96,
    includeFontPadding: false,
  },
  unitText: {
    fontSize: 22,
    fontWeight: '500',
    letterSpacing: 0.4,
    marginTop: 4,
  },
  unitDash: {
    width: 24,
    height: 1.5,
    backgroundColor: TERRACOTTA,
    marginTop: 12,
    marginBottom: 10,
    borderRadius: 1,
  },
  subText: {
    fontSize: 14,
    fontWeight: '400',
    letterSpacing: 0.3,
  },
  benefitsRow: {
    flexDirection: 'row',
    gap: 8,
    marginBottom: 32,
  },
  benefitChip: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
    paddingHorizontal: 12,
    paddingVertical: 7,
    borderRadius: 100,
    overflow: 'hidden',
  },
  benefitText: {
    fontSize: 12,
    fontWeight: '700',
    letterSpacing: 1.4,
    textTransform: 'uppercase',
  },
  actionsRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 16,
  },
  primaryBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 10,
    backgroundColor: TERRACOTTA,
    paddingVertical: 16,
    paddingHorizontal: 28,
    borderRadius: 100,
    shadowColor: '#000',
    shadowOpacity: 0.12,
    shadowRadius: 14,
    shadowOffset: { width: 0, height: 4 },
  },
  primaryText: {
    color: CREAM,
    fontSize: 17,
    fontWeight: '500',
    letterSpacing: 0.5,
  },
  unlockBtn: {
    paddingVertical: 8,
  },
  unlockText: {
    fontSize: 14,
    fontWeight: '500',
    letterSpacing: 0.5,
    textDecorationLine: 'underline',
  },
});
