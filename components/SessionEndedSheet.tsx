import { Feather } from '@expo/vector-icons';
import {
  type BottomSheetBackdropProps,
  BottomSheetModal,
  BottomSheetView,
} from '@gorhom/bottom-sheet';
import { haptics } from '@/lib/haptics';
import { useCallback, useEffect, useRef } from 'react';
import { Dimensions, Image, Pressable, StyleSheet, Text, View } from 'react-native';
import Animated, {
  useAnimatedStyle,
  useSharedValue,
  withDelay,
  withTiming,
} from 'react-native-reanimated';
import { useSafeAreaInsets } from 'react-native-safe-area-context';

import { Fonts } from '@/constants/theme';
import { EASE_OUT } from '@/constants/animations';
import { timerDisplay } from '@/lib/format';
import { palette, type AppTheme } from '@/lib/theme';
import { useBottomSheetModalVisibility } from '@/hooks/useBottomSheetModalVisibility';
import EyebrowChip from '@/components/EyebrowChip';
import Starscape from '@/components/Starscape';

const SCREEN_W = Dimensions.get('window').width;
const SCREEN_H = Dimensions.get('window').height;
const PAUSE_SIZE = Math.min(Math.round(SCREEN_W * 0.6), 280);
const pauseImage = require('@/assets/images/pause.png');

// 30 grains reads as texture without becoming visually noisy. Higher
// counts blur into a solid bar; lower counts feel chunky.
const PROGRESS_DOT_COUNT = 30;

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
  /** What ended the session — currently always 'manual' when the sheet
      is visible (interrupt button or backgrounding both delegate to
      pauseSession). Kept as a discriminator for future flows. */
  cancelReason: 'manual' | null;
  /** 'block' when the running session was triggered by a scheduled
      block (apps still locked behind Screen Time); 'normal' for any
      user-started session. Drives the third action's label. */
  sessionOrigin?: 'normal' | 'block';
  /** Resume the paused session. */
  onContinue?: () => void;
  /** Save what's elapsed so far + reset to 0 and keep running. */
  onStartOver?: () => void;
  /** Save the paused session and exit to home. */
  onEnd?: () => void;
  /** Block-flow only — unblock Screen Time + end the session. */
  onUnlock?: () => void;
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
  return <View pointerEvents="auto" style={StyleSheet.absoluteFillObject} />;
}

function SessionEndedSheet({
  visible,
  theme,
  interruptedDuration,
  goalSeconds,
  cancelReason,
  sessionOrigin = 'normal',
  onContinue,
  onStartOver,
  onEnd,
  onUnlock,
  onClose,
}: Props) {
    const insets = useSafeAreaInsets();
    const internalRef = useRef<BottomSheetModal>(null);

    // Pause icon lives in its own absolute overlay (rendered as a
    // sibling to the modal) — putting it inside the backdrop tied its
    // position to gorhom's animatedPosition, so on dismiss it slid down
    // with the sheet instead of fading in place. With its own
    // SharedValue we drive fade-in / fade-out alongside the sheet's
    // own animation (no delay — the icon should land WITH the sheet,
    // not after it) and dismiss in the same window.
    const iconOpacity = useSharedValue(0);
    useEffect(() => {
      if (visible) {
        iconOpacity.value = withTiming(1, { duration: 360, easing: EASE_OUT });
      } else {
        iconOpacity.value = withTiming(0, { duration: 220, easing: EASE_OUT });
      }
    }, [visible, iconOpacity]);

    const overlayStyle = useAnimatedStyle(() => ({
      opacity: iconOpacity.value,
    }));

    // BottomSheetModal renders into a portal — no z-index/layout
    // wrestling with the running camera, and `dismiss()` always
    // closes cleanly (controlled `index={-1}` is broken in gorhom v5,
    // since handleSnapToIndex(-1) reads detents[-1] = undefined).
    useBottomSheetModalVisibility(internalRef, visible);

    const handleContinue = useCallback(() => {
      haptics.medium();
      onContinue?.();
    }, [onContinue]);

    const handleStartOver = useCallback(() => {
      haptics.light();
      onStartOver?.();
    }, [onStartOver]);

    const handleEnd = useCallback(() => {
      haptics.light();
      onEnd?.();
    }, [onEnd]);

    const handleUnlock = useCallback(() => {
      haptics.success();
      onUnlock?.();
    }, [onUnlock]);

    const isBlockSession = sessionOrigin === 'block';

    // The user paused mid-session — they did NOT finish. Copy and
    // visuals lean into "here's what's still ahead" rather than any
    // congratulatory framing. The big number is the focal point:
    // remaining time when there's a goal, elapsed time otherwise.
    const elapsed = Math.max(0, interruptedDuration ?? 0);
    const hasGoal = goalSeconds > 0;
    const remaining = hasGoal ? Math.max(0, goalSeconds - elapsed) : 0;
    const heroSeconds = hasGoal ? remaining : elapsed;
    // Only the countdown side needs a caption ("left to do nothing")
    // because the number alone is ambiguous (remaining vs elapsed). In
    // stopwatch mode the number is just elapsed time — the PAUSED
    // eyebrow already gives the context, no caption needed.
    const heroLabel = hasGoal ? 'left to do nothing' : null;
    // Eyebrow is the context badge ("you're on a pause"); the caption
    // under the big number is the label of the number itself ("this is
    // what's left"). Keeping eyebrow="paused" for both modes avoids the
    // earlier dupe where "still to go" + "left to do nothing" said the
    // same thing twice.
    const eyebrow = 'paused';
    const progressPct = hasGoal
      ? Math.min(100, Math.max(0, (elapsed / goalSeconds) * 100))
      : 0;

    return (
      <>
      <Animated.View
        pointerEvents="none"
        style={[styles.pauseOverlay, overlayStyle]}
      >
        <Image source={pauseImage} style={styles.pauseImage} fadeDuration={0} />
      </Animated.View>
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
            <EyebrowChip text={eyebrow} />
          </View>

          {/* Hero — big mono number with a soft caption underneath.
              Goal mode: shows time remaining; free mode: shows what
              they've done so far. Same scattered-dot starscape as
              BlockSheet for visual continuity. In stopwatch (free)
              mode the progress bar is hidden, so we add bottom
              padding here to keep breathing room before the
              continue pill instead of cramming the timer onto it. */}
          <View
            style={[
              styles.starscape,
              !hasGoal && styles.starscapeFree,
            ]}
          >
            <Starscape textColor={theme.text} pattern="pause" />

            <Text
              style={[
                styles.bigNumber,
                { color: theme.text, fontFamily: Fonts!.mono },
              ]}
            >
              {timerDisplay(heroSeconds)}
            </Text>
            {heroLabel && (
              <Text
                style={[
                  styles.heroCaption,
                  { color: theme.text, fontFamily: Fonts!.serif },
                ]}
              >
                {heroLabel}
              </Text>
            )}
          </View>

          {/* Progress visual — a row of "sand grains" in tune with the
              hourglass icon above the sheet. Each grain represents 1/N
              of the goal; past ones land in terracotta, the leading one
              is bigger and shadowed (the grain currently dropping), and
              future ones sit in muted sand. Reads as texture, not a
              generic progress bar. Hidden in free mode where there's
              no goal to track against. */}
          {hasGoal && (
            <View style={styles.progressWrap}>
              <View style={styles.progressTrack}>
                {Array.from({ length: PROGRESS_DOT_COUNT }, (_, i) => {
                  // Each grain occupies 1/N of the bar; we mark grain i
                  // as "passed" when its centre is on the elapsed side.
                  const grainCentre = (i + 0.5) / PROGRESS_DOT_COUNT;
                  const isFilled = grainCentre <= progressPct / 100;
                  const isLead =
                    isFilled &&
                    grainCentre > progressPct / 100 - 1 / PROGRESS_DOT_COUNT;
                  return (
                    <View
                      key={i}
                      style={[
                        styles.progressDot,
                        { backgroundColor: theme.text },
                        isFilled && styles.progressDotFilled,
                        isLead && styles.progressDotLead,
                      ]}
                    />
                  );
                })}
              </View>
              <View style={styles.progressLabels}>
                <Text
                  style={[
                    styles.progressLabelText,
                    { color: TERRACOTTA, fontFamily: Fonts!.mono },
                  ]}
                >
                  {timerDisplay(elapsed)}
                </Text>
                <Text
                  style={[
                    styles.progressLabelText,
                    { color: theme.text, fontFamily: Fonts!.mono },
                  ]}
                >
                  {timerDisplay(goalSeconds)}
                </Text>
              </View>
            </View>
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
              onPress={isBlockSession ? handleUnlock : handleEnd}
              style={({ pressed }) => [
                styles.secondaryChip,
                pressed && styles.secondaryChipPressed,
              ]}
              hitSlop={8}
            >
              <Feather
                name={isBlockSession ? 'unlock' : 'home'}
                size={14}
                color={BROWN}
              />
              <Text
                style={[styles.secondaryText, { fontFamily: Fonts!.serif }]}
              >
                {isBlockSession ? 'unlock now' : 'back home'}
              </Text>
            </Pressable>
          </View>
        </BottomSheetView>
      </BottomSheetModal>
      </>
    );
}

export default SessionEndedSheet;

const CREAM = palette.cream;
const BROWN = palette.brown;
const TERRACOTTA = palette.terracotta;
const CHIP_LIGHT = palette.sand;

const styles = StyleSheet.create({
  // Fixed position relative to the screen so the icon doesn't slide
  // down with the sheet on dismiss — it just fades. Sits at ~25% from
  // the top, which lands roughly above the sheet's top edge on
  // standard iPhone heights regardless of sheet content size.
  pauseOverlay: {
    position: 'absolute',
    top: SCREEN_H * 0.25 - PAUSE_SIZE / 2,
    left: 0,
    right: 0,
    alignItems: 'center',
    zIndex: 0,
  },
  pauseImage: {
    width: PAUSE_SIZE,
    height: PAUSE_SIZE,
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
  starscape: {
    alignSelf: 'stretch',
    alignItems: 'center',
    paddingTop: 24,
    paddingBottom: 0,
    paddingHorizontal: 8,
    position: 'relative',
  },
  // Stopwatch mode hides the progress bar between the timer and the
  // continue pill — without that gap the pill crowds the numeral. Add
  // the same vertical air the progress block normally provides.
  starscapeFree: {
    paddingBottom: 36,
  },
  bigNumber: {
    fontSize: 84,
    fontVariant: ['tabular-nums'],
    fontWeight: '300',
    letterSpacing: 2,
    lineHeight: 90,
    includeFontPadding: false,
    alignSelf: 'stretch',
    textAlign: 'center',
  },
  heroCaption: {
    fontSize: 13,
    fontWeight: '400',
    letterSpacing: 0.4,
    marginTop: 8,
  },
  // Sand track + terracotta fill — the visual answer to "how far did
  // I get". Done/goal labels under the bar give the exact numbers
  // without forcing a separate MM:SS line elsewhere on the sheet.
  progressWrap: {
    alignSelf: 'stretch',
    paddingHorizontal: 8,
    marginTop: 28,
    marginBottom: 24,
  },
  progressTrack: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    height: 14,
  },
  // Future grains — themed text colour applied inline (brown on light,
  // cream on dark). At 2.5px the dot stays restrained while reading
  // clearly on both backgrounds.
  progressDot: {
    width: 2.5,
    height: 2.5,
    borderRadius: 100,
  },
  // Past grains — terracotta, slightly bigger so the elapsed side
  // reads as solidly "done".
  progressDotFilled: {
    width: 4,
    height: 4,
    backgroundColor: TERRACOTTA,
  },
  // Leading grain — the one currently "dropping". Larger with a soft
  // halo around it; gives the bar a focal point so the eye knows
  // exactly where progress is.
  progressDotLead: {
    width: 14,
    height: 14,
    backgroundColor: TERRACOTTA,
    shadowColor: TERRACOTTA,
    shadowOpacity: 0.35,
    shadowRadius: 8,
    shadowOffset: { width: 0, height: 0 },
  },
  progressLabels: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    marginTop: 14,
  },
  progressLabelText: {
    fontSize: 12,
    fontWeight: '500',
    fontVariant: ['tabular-nums'],
    letterSpacing: 0.6,
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
