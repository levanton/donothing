import { Feather } from '@expo/vector-icons';
import {
  type BottomSheetBackdropProps,
  BottomSheetModal,
  BottomSheetView,
} from '@gorhom/bottom-sheet';
import * as Haptics from 'expo-haptics';
import { useCallback, useEffect, useRef } from 'react';
import { Pressable, StyleSheet, Text, View } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';

import { Fonts } from '@/constants/theme';
import { timerDisplay } from '@/lib/format';
import { palette, type AppTheme } from '@/lib/theme';

interface Props {
  /** Whether the sheet should be expanded. Drives expand/close on
      the internal BottomSheet ref — replaces forwardRef + parent-
      side useEffect, which was racing with mount-timing on cold
      starts and silently failing when used during a paused running
      session (parent ref captured a snapshot before mount). */
  visible: boolean;
  theme: AppTheme;
  /** Seconds the session ran before it was cancelled. Null when we
      can't determine it (e.g. cold-start recovery). */
  interruptedDuration: number | null;
  /** Configured goal in seconds — shown as context when the user had
      a countdown set. */
  goalSeconds: number;
  /** What ended the session — drives the eyebrow + caption copy and
      which action set the sheet shows. 'manual' = pause-and-ask
      (continue / start over / end); 'backgrounded' or null = single
      "back home" acknowledgement. */
  cancelReason: 'backgrounded' | 'manual' | null;
  /** Resume the paused session. */
  onContinue?: () => void;
  /** Save what's elapsed so far + reset to 0 and keep running. */
  onStartOver?: () => void;
  /** Save the paused session and exit to home. */
  onEnd?: () => void;
  onClose?: () => void;
}

// Transparent backdrop — the modal renders into a portal above the
// running screen, and the running screen is already terracotta with
// its own DriftingDots layer (frozen via the `paused` flag). Drawing
// our own coloured wash here would cover those dots and replace them
// with a different static set, which read as "new dots appearing"
// the moment pause kicked in. By staying transparent, the user sees
// the same dots they were watching, simply held in place.
function TerracottaBackdrop({}: BottomSheetBackdropProps) {
  return (
    <View
      pointerEvents="auto"
      style={StyleSheet.absoluteFillObject}
    />
  );
}

function SessionEndedSheet({
  visible,
  theme,
  interruptedDuration,
  goalSeconds,
  cancelReason,
  onContinue,
  onStartOver,
  onEnd,
  onClose,
}: Props) {
    const insets = useSafeAreaInsets();
    const internalRef = useRef<BottomSheetModal>(null);

    // BottomSheetModal renders into a portal — no z-index/layout
    // wrestling with the running camera, and `dismiss()` always
    // closes cleanly (controlled `index={-1}` is broken in gorhom v5,
    // since handleSnapToIndex(-1) reads detents[-1] = undefined).
    useEffect(() => {
      if (visible) internalRef.current?.present();
      else internalRef.current?.dismiss();
    }, [visible]);

    const handleContinue = useCallback(() => {
      Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Medium).catch(() => {});
      onContinue?.();
    }, [onContinue]);

    const handleStartOver = useCallback(() => {
      Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light).catch(() => {});
      onStartOver?.();
    }, [onStartOver]);

    const handleEnd = useCallback(() => {
      Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light).catch(() => {});
      onEnd?.();
    }, [onEnd]);

    const hasDuration =
      interruptedDuration != null && interruptedDuration > 0;
    const eyebrow = 'session ended';
    const caption = 'well done';
    // Sub-text — for paused sessions with a goal still ahead, show
    // the remaining MM:SS so the user sees how close they are.
    const remaining =
      hasDuration && goalSeconds > 0 && interruptedDuration! < goalSeconds
        ? goalSeconds - interruptedDuration!
        : null;
    const sub =
      remaining != null
        ? `${timerDisplay(remaining)} still ahead`
        : 'ready when you are';

    return (
      <BottomSheetModal
        ref={internalRef}
        // Size the sheet to its measured content. Modal renders in a
        // portal so layout/z-index of the host screen don't interfere.
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
          {/* Eyebrow pill — uppercase serif on warm sand chip,
              matching BlockSheet's eyebrow. */}
          <View style={styles.eyebrowRow}>
            <View style={[styles.eyebrowPill, { backgroundColor: CHIP_LIGHT }]}>
              <Text
                style={[
                  styles.eyebrowText,
                  { color: BROWN, fontFamily: Fonts!.serif },
                ]}
              >
                {eyebrow}
              </Text>
            </View>
          </View>

          {/* Hero — scattered dots around either the elapsed time
              (mono, big) or, when we have nothing to display, the
              caption alone. Same starscape vocabulary as BlockSheet. */}
          <View style={styles.starscape}>
            <View
              style={[
                styles.star,
                { top: 6, left: 30, width: 3, height: 3, backgroundColor: theme.text, opacity: 0.5 },
              ]}
            />
            <View
              style={[
                styles.star,
                { top: 24, left: 70, width: 5, height: 5, backgroundColor: TERRACOTTA },
              ]}
            />
            <View
              style={[
                styles.star,
                { top: 44, left: 12, width: 4, height: 4, backgroundColor: theme.text, opacity: 0.35 },
              ]}
            />
            <View
              style={[
                styles.star,
                { top: 14, right: 36, width: 4, height: 4, backgroundColor: theme.text, opacity: 0.7 },
              ]}
            />
            <View
              style={[
                styles.star,
                { top: 48, right: 18, width: 3, height: 3, backgroundColor: TERRACOTTA, opacity: 0.8 },
              ]}
            />
            <View
              style={[
                styles.star,
                { bottom: 22, left: 40, width: 5, height: 5, backgroundColor: theme.text, opacity: 0.4 },
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
                { bottom: 8, right: 24, width: 4, height: 4, backgroundColor: theme.text, opacity: 0.5 },
              ]}
            />

            {hasDuration ? (
              <Text
                style={[
                  styles.bigNumber,
                  { color: theme.text, fontFamily: Fonts!.mono },
                ]}
              >
                {timerDisplay(interruptedDuration!)}
              </Text>
            ) : (
              <View style={styles.heroSpacer} />
            )}

            <Text
              style={[
                styles.heroCaption,
                { color: theme.text, fontFamily: Fonts!.serif },
              ]}
            >
              {caption}
            </Text>
            <Text
              style={[
                styles.heroSub,
                { color: theme.textTertiary, fontFamily: Fonts!.serif },
              ]}
            >
              {sub}
            </Text>
          </View>

          <View
            style={[styles.heroSubRule, { backgroundColor: theme.border }]}
          />

          {/* Manual pause action set — continue (primary), start over
              and back home (chip pair). */}
          {goalSeconds > 0 &&
            interruptedDuration != null &&
            interruptedDuration < goalSeconds && (
              <Text
                style={[
                  styles.motivation,
                  { color: theme.text, fontFamily: Fonts!.serif },
                ]}
              >
                {timerDisplay(goalSeconds - interruptedDuration)} still ahead
              </Text>
            )}
          <Pressable
            onPress={handleContinue}
            style={({ pressed }) => [
              styles.primaryBtn,
              pressed && styles.primaryBtnPressed,
            ]}
            hitSlop={8}
          >
            <Text style={[styles.primaryText, { fontFamily: Fonts!.serif }]}>
              continue
            </Text>
          </Pressable>
          <View style={styles.secondaryRow}>
            <Pressable
              onPress={handleStartOver}
              style={({ pressed }) => [
                styles.secondaryChip,
                pressed && styles.secondaryChipPressed,
              ]}
              hitSlop={8}
            >
              <Feather name="rotate-ccw" size={14} color={BROWN} />
              <Text
                style={[styles.secondaryText, { fontFamily: Fonts!.serif }]}
              >
                start over
              </Text>
            </Pressable>
            <Pressable
              onPress={handleEnd}
              style={({ pressed }) => [
                styles.secondaryChip,
                pressed && styles.secondaryChipPressed,
              ]}
              hitSlop={8}
            >
              <Feather name="home" size={14} color={BROWN} />
              <Text
                style={[styles.secondaryText, { fontFamily: Fonts!.serif }]}
              >
                back home
              </Text>
            </Pressable>
          </View>
        </BottomSheetView>
      </BottomSheetModal>
    );
}

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
  bigNumber: {
    fontSize: 84,
    fontVariant: ['tabular-nums'],
    fontWeight: '300',
    letterSpacing: 2,
    lineHeight: 90,
    includeFontPadding: false,
  },
  // When the duration is unknown, keep the starscape visually anchored
  // by reserving roughly the height a number would have taken.
  heroSpacer: {
    height: 28,
  },
  heroCaption: {
    fontSize: 18,
    fontWeight: '500',
    letterSpacing: 0.4,
    marginTop: 16,
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
  // Quiet motivational line tying the remaining countdown to the
  // continue action right below it.
  motivation: {
    fontSize: 14,
    letterSpacing: 0.3,
    textAlign: 'center',
    opacity: 0.72,
    marginBottom: 12,
  },
  // Secondary actions in the manual flow — twin warm-sand chips
  // side-by-side. Same vocabulary as BlockSheet's benefit chips so
  // the UI feels like one coherent system, not three different
  // button styles competing for attention.
  secondaryRow: {
    flexDirection: 'row',
    justifyContent: 'center',
    gap: 10,
    marginTop: 18,
  },
  secondaryChip: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
    backgroundColor: CHIP_LIGHT,
    paddingHorizontal: 18,
    paddingVertical: 12,
    borderRadius: 100,
    minWidth: 132,
    justifyContent: 'center',
  },
  secondaryChipPressed: {
    opacity: 0.85,
    transform: [{ scale: 0.98 }],
  },
  secondaryText: {
    color: BROWN,
    fontSize: 14,
    fontWeight: '600',
    letterSpacing: 0.3,
  },
});
