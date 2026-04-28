import { Feather } from '@expo/vector-icons';
import {
  type BottomSheetBackdropProps,
  BottomSheetModal,
  BottomSheetView,
} from '@gorhom/bottom-sheet';
import * as Haptics from 'expo-haptics';
import { useCallback, useEffect, useRef } from 'react';
import {
  Dimensions,
  Image,
  Pressable,
  StyleSheet,
  Text,
  View,
} from 'react-native';
import Animated, {
  cancelAnimation,
  Easing,
  Extrapolation,
  interpolate,
  runOnJS,
  useAnimatedStyle,
  useSharedValue,
  withTiming,
} from 'react-native-reanimated';
import { useSafeAreaInsets } from 'react-native-safe-area-context';

import { Fonts } from '@/constants/theme';
import { palette, type AppTheme } from '@/lib/theme';

const SCREEN_W = Dimensions.get('window').width;

const MOUNTAIN_SIZE = Math.min(Math.round(SCREEN_W * 0.62), 280);

const mountainImage = require('@/assets/images/mountain.png');

interface Props {
  /** Whether the sheet should be open. Drives present()/dismiss()
      on the internal BottomSheetModal ref — the controlled-index
      path of the plain BottomSheet was unreliable on first paint
      (gorhom v5's handleSnapToIndex(-1) looks up detents[-1] which
      is undefined), so we use the modal's portal-backed methods. */
  visible: boolean;
  theme: AppTheme;
  unlockMin: number;
  onStart: (minutes: number) => void;
  onUnlock: () => void;
  onClose?: () => void;
}

function TerracottaBackdrop({
  animatedIndex,
  animatedPosition,
}: BottomSheetBackdropProps) {
  const animatedStyle = useAnimatedStyle(() => ({
    opacity: interpolate(
      animatedIndex.value,
      [-1, 0],
      [0, 1],
      Extrapolation.CLAMP,
    ),
  }));
  // Sit the mountain slightly below the midpoint between the screen top
  // and the sheet top so it feels grounded against the sheet edge.
  const mountainStyle = useAnimatedStyle(() => ({
    top: Math.max(0, animatedPosition.value * 0.58 - MOUNTAIN_SIZE / 2),
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
      <Animated.View
        style={[styles.backdropImageWrap, mountainStyle]}
        pointerEvents='none'
      >
        <Image
          source={mountainImage}
          style={styles.backdropImage}
          fadeDuration={0}
        />
      </Animated.View>
    </Animated.View>
  );
}

function BlockSheet({
  visible,
  theme,
  unlockMin,
  onStart,
  onUnlock,
  onClose,
}: Props) {
    const insets = useSafeAreaInsets();
    const internalRef = useRef<BottomSheetModal>(null);

    // Drive present()/dismiss() from the visible prop. BottomSheetModal
    // queues the request internally if layout isn't ready yet, so a
    // first-paint cold start shows the sheet reliably without a
    // requestAnimationFrame song-and-dance.
    useEffect(() => {
      if (visible) internalRef.current?.present();
      else internalRef.current?.dismiss();
    }, [visible]);

    const handleBegin = useCallback(() => {
      Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Medium).catch(() => {});
      onStart(unlockMin);
    }, [onStart, unlockMin]);

    // Hold-to-unlock — short press does nothing, must hold for 1.5s.
    const holdProgress = useSharedValue(0);

    const triggerUnlock = useCallback(() => {
      Haptics.notificationAsync(
        Haptics.NotificationFeedbackType.Success,
      ).catch(() => {});
      onUnlock();
    }, [onUnlock]);

    const handleHoldStart = useCallback(() => {
      Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light).catch(() => {});
      holdProgress.value = withTiming(
        1,
        { duration: 1500, easing: Easing.linear },
        (finished) => {
          if (finished) {
            holdProgress.value = 0;
            runOnJS(triggerUnlock)();
          }
        },
      );
    }, [holdProgress, triggerUnlock]);

    const handleHoldEnd = useCallback(() => {
      cancelAnimation(holdProgress);
      holdProgress.value = withTiming(0, {
        duration: 200,
        easing: Easing.out(Easing.quad),
      });
    }, [holdProgress]);

    const holdFillStyle = useAnimatedStyle(() => ({
      width: `${holdProgress.value * 100}%`,
    }));

    return (
      <BottomSheetModal
        ref={internalRef}
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
        onDismiss={onClose}
      >
        <BottomSheetView
          style={[styles.body, { paddingBottom: insets.bottom + 28 }]}
        >
          {/* Eyebrow */}
          <View style={styles.eyebrowRow}>
            <View style={[styles.eyebrowPill, { backgroundColor: CHIP_LIGHT }]}>
              <Text
                style={[
                  styles.eyebrowText,
                  { color: BROWN, fontFamily: Fonts!.serif },
                ]}
              >
                your apps are locked
              </Text>
            </View>
          </View>

          {/* Starscape hero — scattered dots around the number, poetic */}
          <View style={styles.starscape}>
            <View
              style={[
                styles.star,
                { top: 4, left: 24, width: 3, height: 3, backgroundColor: theme.text, opacity: 0.5 },
              ]}
            />
            <View
              style={[
                styles.star,
                { top: 18, left: 62, width: 5, height: 5, backgroundColor: TERRACOTTA },
              ]}
            />
            <View
              style={[
                styles.star,
                { top: 36, left: 8, width: 4, height: 4, backgroundColor: theme.text, opacity: 0.35 },
              ]}
            />
            <View
              style={[
                styles.star,
                { top: 8, right: 30, width: 4, height: 4, backgroundColor: theme.text, opacity: 0.7 },
              ]}
            />
            <View
              style={[
                styles.star,
                { top: 48, right: 14, width: 3, height: 3, backgroundColor: TERRACOTTA, opacity: 0.8 },
              ]}
            />
            <View
              style={[
                styles.star,
                { bottom: 18, left: 32, width: 5, height: 5, backgroundColor: theme.text, opacity: 0.4 },
              ]}
            />
            <View
              style={[
                styles.star,
                { bottom: 30, right: 48, width: 3, height: 3, backgroundColor: TERRACOTTA, opacity: 0.6 },
              ]}
            />
            <View
              style={[
                styles.star,
                { bottom: 6, right: 20, width: 4, height: 4, backgroundColor: theme.text, opacity: 0.5 },
              ]}
            />
            <View
              style={[
                styles.star,
                { top: 60, left: 38, width: 2, height: 2, backgroundColor: theme.text, opacity: 0.4 },
              ]}
            />
            <View
              style={[
                styles.star,
                { top: 80, right: 60, width: 2, height: 2, backgroundColor: TERRACOTTA, opacity: 0.7 },
              ]}
            />
            <View
              style={[
                styles.star,
                { bottom: 50, left: 18, width: 3, height: 3, backgroundColor: TERRACOTTA, opacity: 0.5 },
              ]}
            />
            <View
              style={[
                styles.star,
                { bottom: 60, right: 8, width: 2, height: 2, backgroundColor: theme.text, opacity: 0.6 },
              ]}
            />

            <Text style={[styles.bigNumber, { color: theme.text }]}>
              {unlockMin}
              <Text style={[styles.bigUnit, { fontFamily: Fonts!.serif }]}> min</Text>
            </Text>
            <Text
              style={[
                styles.heroCaption,
                { color: theme.text, fontFamily: Fonts!.serif },
              ]}
            >
              of doing nothing
            </Text>
            <Text
              style={[
                styles.heroSub,
                { color: theme.textTertiary, fontFamily: Fonts!.serif },
              ]}
            >
              to unlock your apps
            </Text>
          </View>

          {/* Short hairline divider — silent connector between the hero
              text and the pills. No word, no symbol, just a hint that
              the list below continues the same thought. */}
          <View
            style={[styles.heroSubRule, { backgroundColor: theme.border }]}
          />

          {/* Benefits pills */}
          <View style={styles.benefitsRow}>
            <View style={[styles.benefitChip, { backgroundColor: CHIP_LIGHT }]}>
              <Feather name='cloud' size={13} color={BROWN} />
              <Text
                style={[
                  styles.benefitText,
                  { color: BROWN, fontFamily: Fonts!.serif },
                ]}
              >
                rest
              </Text>
            </View>
            <View style={[styles.benefitChip, { backgroundColor: CHIP_MID }]}>
              <Feather name='heart' size={13} color={BROWN} />
              <Text
                style={[
                  styles.benefitText,
                  { color: BROWN, fontFamily: Fonts!.serif },
                ]}
              >
                calm
              </Text>
            </View>
            <View style={[styles.benefitChip, { backgroundColor: CHIP_DEEP }]}>
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

          {/* Primary CTA — solid terracotta pill, cream text, generous shadow */}
          <Pressable
            onPress={handleBegin}
            style={({ pressed }) => [
              styles.primaryBtn,
              pressed && styles.primaryBtnPressed,
            ]}
            hitSlop={8}
          >
            <Text style={[styles.primaryText, { fontFamily: Fonts!.serif }]}>
              do nothing
            </Text>
          </Pressable>

          {/* Hold-to-unlock — outlined pill with a salmon fill that
              animates left→right while held. */}
          <Pressable
            onPressIn={handleHoldStart}
            onPressOut={handleHoldEnd}
            hitSlop={20}
          >
            <View style={[styles.holdPill, { borderColor: theme.border }]}>
              <Animated.View
                pointerEvents='none'
                style={[
                  styles.holdFill,
                  { backgroundColor: CHIP_LIGHT },
                  holdFillStyle,
                ]}
              />
              <View style={styles.holdContent} pointerEvents='none'>
                <Feather name='lock' size={14} color={theme.text} />
                <Text
                  style={[
                    styles.holdText,
                    { color: theme.text, fontFamily: Fonts!.serif },
                  ]}
                >
                  hold to unlock now
                </Text>
              </View>
            </View>
          </Pressable>
        </BottomSheetView>
      </BottomSheetModal>
    );
}

export default BlockSheet;

const CREAM = palette.cream;
const BROWN = palette.brown;
const TERRACOTTA = palette.terracotta;
// Warm-earth ladder tied to the app palette — sand → salmon → espresso.
const CHIP_LIGHT = '#EBDAB2'; // warm sand (REST)
const CHIP_MID = palette.salmon; // dusty salmon (CALM)
const CHIP_DEEP = '#3F2C22'; // deep espresso (FOCUS)

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
  bigNumber: {
    fontSize: 84,
    fontFamily: Fonts!.mono,
    fontVariant: ['tabular-nums'],
    fontWeight: '400',
    letterSpacing: 2,
    lineHeight: 90,
    includeFontPadding: false,
  },
  bigUnit: {
    fontSize: 30,
    fontWeight: '400',
    letterSpacing: 0.4,
  },
  heroCaption: {
    fontSize: 18,
    fontWeight: '500',
    letterSpacing: 0.4,
    marginTop: 4,
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
    // Symmetric breathing room — starscape's paddingBottom is 0, so the
    // top and bottom gaps come entirely from this marginVertical.
    marginVertical: 14,
  },
  benefitsRow: {
    flexDirection: 'row',
    gap: 8,
    marginBottom: 28,
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
  primaryBtn: {
    alignSelf: 'stretch',
    backgroundColor: TERRACOTTA,
    borderRadius: 100,
    paddingVertical: 20,
    alignItems: 'center',
    justifyContent: 'center',
    marginBottom: 18,
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
  holdPill: {
    borderWidth: 1.5,
    borderRadius: 100,
    paddingVertical: 14,
    minWidth: 220,
    overflow: 'hidden',
    alignItems: 'center',
    justifyContent: 'center',
  },
  // Fills the full pill width — `paddingHorizontal` lives on holdContent
  // (the inner row), so this absolute fill is bounded by the border, not
  // by the padding area, and the progress can sweep from edge to edge.
  holdFill: {
    position: 'absolute',
    left: 0,
    top: 0,
    bottom: 0,
  },
  holdContent: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
    paddingHorizontal: 32,
  },
  holdText: {
    fontSize: 13,
    fontWeight: '700',
    letterSpacing: 1.5,
    textTransform: 'uppercase',
  },
});
