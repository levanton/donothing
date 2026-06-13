import { Feather } from '@expo/vector-icons';
import {
  type BottomSheetBackdropProps,
  BottomSheetModal,
  BottomSheetView,
} from '@gorhom/bottom-sheet';
import { haptics } from '@/lib/haptics';
import { useFaceDown } from '@/hooks/useFaceDown';
import { useCallback, useEffect, useRef, useState } from 'react';
import { AppState, Dimensions, Image, Pressable, StyleSheet, Text, View } from 'react-native';
import Animated, {
  cancelAnimation,
  Easing,
  FadeIn,
  runOnJS,
  useAnimatedStyle,
  useSharedValue,
  withRepeat,
  withTiming,
} from 'react-native-reanimated';
import { useSafeAreaInsets } from 'react-native-safe-area-context';

import { Fonts } from '@/constants/theme';
import { EASE_OUT } from '@/constants/animations';
import { MIN_SAVABLE_DURATION } from '@/lib/db/sessions';
import { timerDisplay } from '@/lib/format';
import { palette, themes, type AppTheme } from '@/lib/theme';
import { useBottomSheetModalVisibility } from '@/hooks/useBottomSheetModalVisibility';

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
  /** Stopwatch only: finish the run and land on the celebration screen.
      The face-down ritual hides the in-run "done" pill (the phone is
      down while it counts up), so the pause sheet is the only place a
      free-mode session can actually be completed. */
  onFinish?: () => void;
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
  onFinish,
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

    // One shared breathing rhythm for the paused screen — the hourglass
    // floats gently and the leading sand grain pulses on the same slow
    // cycle, so the held session reads as waiting, not dead. The float
    // is mostly movement: a soft 5pt drift with only a whisper of
    // opacity, so the artwork never visibly fades.
    const breath = useSharedValue(0);
    useEffect(() => {
      if (visible) {
        breath.value = withRepeat(
          withTiming(1, { duration: 3000, easing: Easing.inOut(Easing.sin) }),
          -1,
          true,
        );
        return;
      }
      cancelAnimation(breath);
      breath.value = 0;
    }, [visible, breath]);

    const overlayStyle = useAnimatedStyle(() => ({
      opacity: iconOpacity.value * (0.94 + 0.06 * breath.value),
      transform: [{ translateY: -5 * breath.value }],
    }));

    const leadGrainStyle = useAnimatedStyle(() => ({
      transform: [{ scale: 1 + 0.18 * breath.value }],
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

    // The ritual continues the session: putting the phone back face down
    // resumes it (same sustained-reading detector as the start gate). The
    // instruction text below stays tappable as the no-sensor fallback.
    // The resume cue (pulse + chime) fires in resumeSession via onContinue,
    // so it's NOT duplicated here.
    // `available` is false on a simulator / pre-rebuild dev client / a phone
    // whose accelerometer never reports — there the flip-to-resume gesture
    // can never fire, so we surface an explicit "continue" button below
    // instead of leaving the user stuck on a tap-the-heading secret.
    const { faceDown, available } = useFaceDown(visible);
    useEffect(() => {
      if (!visible || !faceDown) return;
      onContinue?.();
    }, [visible, faceDown, onContinue]);

    const handleStartOver = useCallback(() => {
      haptics.light();
      onStartOver?.();
    }, [onStartOver]);

    const handleEnd = useCallback(() => {
      haptics.light();
      onEnd?.();
    }, [onEnd]);

    const handleFinish = useCallback(() => {
      haptics.success();
      onFinish?.();
    }, [onFinish]);

    const handleUnlock = useCallback(() => {
      haptics.success();
      onUnlock?.();
    }, [onUnlock]);

    // Hold-to-unlock — same ritual as the BlockSheet's pill: a tap does
    // nothing, a sustained 1.5s hold fills the chip and unlocks. Leaving
    // a block early should cost the same deliberate gesture everywhere.
    const holdProgress = useSharedValue(0);
    const handleUnlockHoldStart = useCallback(() => {
      haptics.light();
      holdProgress.value = withTiming(
        1,
        { duration: 1500, easing: Easing.linear },
        (finished) => {
          if (finished) {
            holdProgress.value = 0;
            runOnJS(handleUnlock)();
          }
        },
      );
    }, [holdProgress, handleUnlock]);
    const handleUnlockHoldEnd = useCallback(() => {
      cancelAnimation(holdProgress);
      holdProgress.value = withTiming(0, {
        duration: 200,
        easing: Easing.out(Easing.quad),
      });
    }, [holdProgress]);

    // Cancel an in-flight hold when the app backgrounds — reanimated
    // freezes the timing animation, so a finger still down on return
    // would otherwise complete an unlock the user never finished.
    // onPressOut doesn't fire on background.
    useEffect(() => {
      const sub = AppState.addEventListener('change', (state) => {
        if (state !== 'active') handleUnlockHoldEnd();
      });
      return () => sub.remove();
    }, [handleUnlockHoldEnd]);

    const holdTintStyle = useAnimatedStyle(() => ({
      opacity: holdProgress.value * 0.35,
    }));
    const holdBarStyle = useAnimatedStyle(() => ({
      width: `${holdProgress.value * 100}%`,
    }));

    const isBlockSession = sessionOrigin === 'block';

    // The hourglass centres in the free terracotta band between the top
    // of the screen and the sheet's top edge. The sheet is dynamically
    // sized, so its top is only known after the content measures —
    // until then fall back to the old fixed 25%-height placement.
    const [sheetTopY, setSheetTopY] = useState<number | null>(null);
    const pauseCentreY = sheetTopY != null ? sheetTopY / 2 : SCREEN_H * 0.25;

    // Floating-card geometry. Neither gorhom's detached/bottomInset nor
    // margins on backgroundStyle lift a dynamically-sized modal off the
    // bottom edge (both verified on device — the background container is
    // an absolute fill that ignores bottom margin). So the sheet itself
    // is fully transparent and the visible card is plain content: a
    // regular View with side gutters and a bottom margin clearing the
    // home indicator. Layout margins on flow views cannot be ignored.
    const cardBottomGutter = insets.bottom + 4;

    // The user paused mid-session — they did NOT finish. Copy and
    // visuals lean into "here's what's still ahead" rather than any
    // congratulatory framing. The big number is the focal point:
    // remaining time when there's a goal, elapsed time otherwise.
    const elapsed = Math.max(0, interruptedDuration ?? 0);
    const hasGoal = goalSeconds > 0;
    const remaining = hasGoal ? Math.max(0, goalSeconds - elapsed) : 0;
    const heroSeconds = hasGoal ? remaining : elapsed;
    const progressPct = hasGoal
      ? Math.min(100, Math.max(0, (elapsed / goalSeconds) * 100))
      : 0;

    return (
      <>
      <Animated.View
        pointerEvents="none"
        style={[
          styles.pauseOverlay,
          { top: pauseCentreY - PAUSE_SIZE / 2 },
          overlayStyle,
        ]}
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
        backgroundComponent={null}
        // Positioning is handled by the card's own margins; `detached`
        // is here only because it flips gorhom's content container to
        // overflow: visible — without it the card's top shadow is
        // clipped at the sheet edge.
        detached
        onDismiss={onClose}
      >
        <BottomSheetView
          style={styles.sheetWrap}
          onLayout={(e) =>
            setSheetTopY(SCREEN_H - e.nativeEvent.layout.height)
          }
        >
        <View
          style={[
            styles.card,
            {
              backgroundColor: theme.bg,
              marginBottom: cardBottomGutter,
              // A black drop shadow reads far heavier on the light card's
              // cream than on the dark card's charcoal — soften it
              // sharply in light mode so it stays a lift, not a smear.
              shadowOpacity: theme === themes.light ? 0.12 : 0.4,
            },
          ]}
        >
          {/* The next action, as the sheet's headline: putting the phone
              face down resumes. Tappable as the no-sensor fallback. Set
              in mono — the same instruction voice as the face-down
              gate, so both ritual screens speak one language. */}
          <Animated.View entering={FadeIn.duration(400)}>
            <Pressable onPress={handleContinue} hitSlop={8} style={styles.flipHeading}>
              <Text style={[styles.flipHeadingText, { color: theme.text, fontFamily: Fonts!.mono }]}>
                place the phone{'\n'}face down to continue
              </Text>
            </Pressable>
          </Animated.View>

          {/* Hero — big mono number with a soft caption underneath.
              Goal mode: shows time remaining; free mode: shows what
              they've done so far. In stopwatch (free) mode the
              progress bar is hidden, so we add bottom padding here
              to keep breathing room before the continue pill instead
              of cramming the timer onto it. */}
          <Animated.View
            entering={FadeIn.duration(400).delay(80)}
            style={[
              styles.hero,
              !hasGoal && styles.heroFree,
            ]}
          >
            <Text
              style={[
                styles.bigNumber,
                { color: theme.text, fontFamily: Fonts!.mono },
              ]}
            >
              {timerDisplay(heroSeconds)}
            </Text>
          </Animated.View>

          {/* Progress visual — a row of "sand grains" in tune with the
              hourglass icon above the sheet. Each grain represents 1/N
              of the goal; past ones land in terracotta, the leading one
              is bigger and shadowed (the grain currently dropping), and
              future ones sit in muted sand. Reads as texture, not a
              generic progress bar. Hidden in free mode where there's
              no goal to track against. */}
          {hasGoal && (
            <Animated.View
              entering={FadeIn.duration(400).delay(160)}
              style={styles.progressWrap}
            >
              <View style={styles.progressTrack}>
                {Array.from({ length: PROGRESS_DOT_COUNT }, (_, i) => {
                  // Each grain occupies 1/N of the bar; we mark grain i
                  // as "passed" when its centre is on the elapsed side.
                  const grainCentre = (i + 0.5) / PROGRESS_DOT_COUNT;
                  const isFilled = grainCentre <= progressPct / 100;
                  const isLead =
                    isFilled &&
                    grainCentre > progressPct / 100 - 1 / PROGRESS_DOT_COUNT;
                  // The leading grain — the one currently "dropping" —
                  // pulses on the shared breath so the bar feels held
                  // mid-pour rather than stopped.
                  if (isLead) {
                    return (
                      <Animated.View
                        key={i}
                        style={[
                          styles.progressDot,
                          styles.progressDotFilled,
                          styles.progressDotLead,
                          leadGrainStyle,
                        ]}
                      />
                    );
                  }
                  return (
                    <View
                      key={i}
                      style={[
                        styles.progressDot,
                        { backgroundColor: theme.text },
                        isFilled && styles.progressDotFilled,
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
            </Animated.View>
          )}

          {/* Finish — stopwatch only. The big terracotta CTA that takes
              a free-mode run to the celebration / mood / farewell flow.
              Locked below MIN_SAVABLE_DURATION with a countdown hint,
              mirroring the in-run "done" pill the face-down ritual
              hides. Goal-mode runs auto-complete at 00:00, so they don't
              need it. */}
          {!hasGoal && onFinish && (() => {
            const canSave = elapsed >= MIN_SAVABLE_DURATION;
            const remainingToSave = Math.max(0, MIN_SAVABLE_DURATION - elapsed);
            return (
              <Animated.View
                entering={FadeIn.duration(400).delay(200)}
                style={styles.finishWrap}
              >
                <Pressable
                  onPress={canSave ? handleFinish : undefined}
                  disabled={!canSave}
                  style={[styles.finishBtn, !canSave && styles.finishBtnDisabled]}
                  hitSlop={8}
                  accessibilityRole="button"
                  accessibilityLabel="Finish session"
                  accessibilityState={{ disabled: !canSave }}
                >
                  <Text style={[styles.finishText, { fontFamily: Fonts!.serif }]}>
                    done
                  </Text>
                  {!canSave && (
                    <Text style={[styles.finishHint, { fontFamily: Fonts!.mono }]}>
                      {timerDisplay(remainingToSave)}
                    </Text>
                  )}
                </Pressable>
              </Animated.View>
            );
          })()}

          {/* No-sensor fallback. When the accelerometer is unavailable the
              face-down flip can't resume the session, so give an explicit
              full-width "continue" pill. Hidden whenever the sensor works —
              there, the ritual flip (or the tappable heading) is the way
              back, and a button would undercut the put-it-down gesture. */}
          {!available && (
            <Animated.View
              entering={FadeIn.duration(400).delay(220)}
              style={styles.finishWrap}
            >
              <Pressable
                onPress={handleContinue}
                style={({ pressed }) => [
                  styles.primaryBtn,
                  pressed && styles.primaryBtnPressed,
                ]}
                hitSlop={8}
                accessibilityRole="button"
                accessibilityLabel="Continue session"
              >
                <Text style={[styles.primaryText, { fontFamily: Fonts!.serif }]}>
                  continue
                </Text>
              </Pressable>
            </Animated.View>
          )}

          <Animated.View
            entering={FadeIn.duration(400).delay(240)}
            style={styles.secondaryRow}
          >
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
            {isBlockSession ? (
              <Pressable
                onPressIn={handleUnlockHoldStart}
                onPressOut={handleUnlockHoldEnd}
                style={styles.secondaryChip}
                hitSlop={8}
                accessibilityRole="button"
                accessibilityLabel="Hold to unlock now"
              >
                <Animated.View
                  pointerEvents="none"
                  style={[
                    styles.holdTint,
                    { backgroundColor: TERRACOTTA },
                    holdTintStyle,
                  ]}
                />
                <Feather name="unlock" size={14} color={BROWN} />
                <Text
                  style={[styles.secondaryText, { fontFamily: Fonts!.serif }]}
                >
                  hold to unlock
                </Text>
                <Animated.View
                  pointerEvents="none"
                  style={[
                    styles.holdBar,
                    { backgroundColor: TERRACOTTA },
                    holdBarStyle,
                  ]}
                />
              </Pressable>
            ) : (
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
            )}
          </Animated.View>
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
  flipHeading: {
    alignItems: 'center',
    marginBottom: 4,
  },
  flipHeadingText: {
    fontSize: 17,
    lineHeight: 26,
    letterSpacing: 0.5,
    textAlign: 'center',
  },
  // Fixed position relative to the screen so the icon doesn't slide
  // down with the sheet on dismiss — it just fades. The vertical
  // placement (centred in the band above the measured sheet) is
  // applied inline.
  pauseOverlay: {
    position: 'absolute',
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
  // Transparent sheet content: a 12pt side gutter around the card.
  sheetWrap: {
    paddingHorizontal: 12,
  },
  // The visible floating card — colour, bottom gutter and shadowOpacity
  // (theme-dependent) applied inline. Soft drop shadow lifts the card
  // off the terracotta backdrop.
  card: {
    borderRadius: 36,
    paddingHorizontal: 28,
    paddingTop: 28,
    paddingBottom: 28,
    alignItems: 'center',
    shadowColor: '#000',
    shadowRadius: 10,
    shadowOffset: { width: 0, height: 5 },
  },
  hero: {
    alignSelf: 'stretch',
    alignItems: 'center',
    paddingTop: 24,
    paddingBottom: 0,
    paddingHorizontal: 8,
  },
  // Stopwatch mode hides the progress bar between the timer and the
  // continue pill — without that gap the pill crowds the numeral. Add
  // the same vertical air the progress block normally provides.
  heroFree: {
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
    fontSize: 14,
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
  // Finish CTA (stopwatch only) — full-width terracotta pill, the app's
  // primary-action identity. Sits above the secondary chip row as the
  // emphasised "I'm done, celebrate it" choice. The wrapper carries the
  // stretch so the FadeIn Animated.View doesn't shrink to content and
  // strand the pill at intrinsic width.
  finishWrap: {
    alignSelf: 'stretch',
  },
  finishBtn: {
    alignSelf: 'stretch',
    backgroundColor: TERRACOTTA,
    borderRadius: 100,
    paddingVertical: 12,
    alignItems: 'center',
    justifyContent: 'center',
  },
  finishBtnDisabled: {
    // Same fill, dimmed — reads as "the same button, not yet ready",
    // matching the in-run done pill's disabled treatment.
    opacity: 0.4,
  },
  finishText: {
    color: CREAM,
    fontSize: 18,
    fontWeight: '600',
    letterSpacing: 0.6,
  },
  finishHint: {
    color: CREAM,
    fontSize: 11,
    fontVariant: ['tabular-nums'],
    letterSpacing: 0.5,
    marginTop: 2,
    opacity: 0.8,
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
    // Clips the hold tint/progress bar to the pill curve.
    overflow: 'hidden',
  },
  // Hold-to-unlock feedback — mirrors the BlockSheet pill: a soft
  // terracotta tint across the chip plus a thin honest progress bar.
  holdTint: {
    ...StyleSheet.absoluteFillObject,
  },
  holdBar: {
    position: 'absolute',
    left: 0,
    bottom: 0,
    height: 2.5,
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
