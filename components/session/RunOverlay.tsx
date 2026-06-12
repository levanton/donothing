import { useEffect, useState } from 'react';
import { Pressable, StyleSheet, Text, View, type ViewStyle } from 'react-native';
import Animated, {
  Easing,
  useAnimatedStyle,
  useSharedValue,
  withTiming,
  type AnimatedStyle,
  type SharedValue,
} from 'react-native-reanimated';

import AnimatedTimerDisplay from '@/components/AnimatedTimerDisplay';
import DriftingDots from '@/components/DriftingDots';
import FaceDownGate from '@/components/FaceDownGate';
import { YES_BUTTON_SIZE } from '@/components/home/constants';
import { Fonts } from '@/constants/theme';
import { MIN_SAVABLE_DURATION } from '@/lib/db/sessions';
import { timerDisplay } from '@/lib/format';
import { palette, type AppTheme } from '@/lib/theme';

interface RunOverlayProps {
  theme: AppTheme;
  insetsBottom: number;
  started: boolean;
  paused: boolean;
  awaitingFaceDown: boolean;
  /** True while the pause sheet / face-down gate owns the screen — the
   *  running timers are not rendered so they can never duplicate the
   *  sheet's MM:SS. */
  suppressed: boolean;
  elapsed: number;
  goalSeconds: number;
  /** The home pane's slide transform — the camera rides it so the
   *  terracotta circle (anchored to the measured yes-button position on
   *  home) doesn't sit pinned at screen-centre while the user has swiped
   *  to settings/history. */
  slideStyle: AnimatedStyle<ViewStyle>;
  /** Screen-dimming fade from useSessionScreen — applied to the running
   *  content so it fades out as the screen darkens. */
  contentStyle: AnimatedStyle<ViewStyle>;
  /** Camera anchor + cover size — owned by HomeShell because the launch
   *  splash shares the same geometry (both land on the yes button). */
  centerX: SharedValue<number>;
  centerY: SharedValue<number>;
  coverSize: SharedValue<number>;
  onPause: () => void;
  onFinishStopwatch: () => void;
}

/**
 * Terracotta camera + running UI. When the user taps yes, the terracotta
 * yes button doesn't shrink to a dot — it expands into a full-screen
 * sheet. The whole running experience lives inside that sheet: cream
 * timer, drifting dots, pause/done pills, the face-down gate.
 * Reuses the splash centre/cover-size math so the geometry is consistent
 * (a circle whose radius reaches the farthest corner from the yes
 * button's measured centre).
 */
export default function RunOverlay({
  theme,
  insetsBottom,
  started,
  paused,
  awaitingFaceDown,
  suppressed,
  elapsed,
  goalSeconds,
  slideStyle,
  contentStyle,
  centerX,
  centerY,
  coverSize,
  onPause,
  onFinishStopwatch,
}: RunOverlayProps) {
  const runExpand = useSharedValue(0);
  // Mount the running UI immediately on start; keep it mounted long
  // enough on stop for the fade-out to play alongside the camera
  // shrinking.
  const [runUiMounted, setRunUiMounted] = useState(false);

  useEffect(() => {
    runExpand.value = withTiming(started ? 1 : 0, {
      // Open slow enough for the terracotta sweep to actually land,
      // close a touch faster — by then the user has already chosen
      // to leave so dawdling reads as "not letting go".
      duration: started ? 1100 : 620,
      easing: Easing.bezier(0.22, 1, 0.36, 1),
    });
    if (started) {
      setRunUiMounted(true);
      return;
    }
    const t = setTimeout(() => setRunUiMounted(false), 640);
    return () => clearTimeout(t);
  }, [started]);

  const terraCameraStyle = useAnimatedStyle(() => {
    // Scale-based animation runs purely on the GPU — no per-frame
    // layout work. The view stays a fixed YES_BUTTON_SIZE circle anchored
    // at the yes button centre; only `transform: scale` changes.
    // Far smoother than animating width/height/borderRadius.
    const maxScale = coverSize.value / YES_BUTTON_SIZE;
    const scale = 1 + runExpand.value * (maxScale - 1);
    return {
      width: YES_BUTTON_SIZE,
      height: YES_BUTTON_SIZE,
      borderRadius: YES_BUTTON_SIZE / 2,
      left: centerX.value - YES_BUTTON_SIZE / 2,
      top: centerY.value - YES_BUTTON_SIZE / 2,
      transform: [{ scale }],
      // Hide the camera entirely at rest so it doesn't sit on top of
      // the yes button at the same 140px size and steal the label.
      opacity: runExpand.value < 0.001 ? 0 : 1,
    };
  });

  // Running UI fades in during the last third of the expansion so the
  // terracotta lands first, then the cream content arrives — feels like
  // the camera "settles" before showing its inside.
  const runUiStyle = useAnimatedStyle(() => ({
    opacity: Math.max(0, Math.min(1, (runExpand.value - 0.6) / 0.35)),
  }));

  return (
    <Animated.View
      pointerEvents="box-none"
      style={[StyleSheet.absoluteFill, slideStyle]}
    >
      <Animated.View
        pointerEvents="none"
        style={[
          styles.runCamera,
          { backgroundColor: theme.accent },
          terraCameraStyle,
        ]}
      />

      {/* Running UI — cream-on-terracotta. Stays mounted briefly after
          a session ends so the fade-out reads alongside the camera
          shrinking, then unmounts cleanly. */}
      {runUiMounted && (
        <Animated.View
          style={[styles.runLayer, runUiStyle]}
          pointerEvents="box-none"
        >
          {/* "Put me face down" gate — the armed state's whole UI. */}
          {awaitingFaceDown && <FaceDownGate />}

          {/* Drifting cream dots — atmospheric layer that floats up
              through the screen, like dust motes in golden-hour
              light. Behind the timer in z-order. Wrapped so the
              hide-toggle fades the whole layer alongside everything
              else, instead of cutting it off mid-motion. Frozen
              while paused so the room feels stilled by the user's
              interruption. */}
          <Animated.View
            style={[StyleSheet.absoluteFill, contentStyle]}
            pointerEvents="none"
          >
            <DriftingDots
              active={runUiMounted && !paused}
              color={palette.cream}
            />
          </Animated.View>

          {/* Big cream timer at vertical centre. NOT rendered at all while the
              interrupt sheet is up (paused / lock) so it can never duplicate the
              sheet's MM:SS — the paused state always wins. */}
          {(!suppressed || awaitingFaceDown) && (
            <Animated.View
              style={[styles.runCenter, contentStyle]}
              pointerEvents="none"
            >
              <AnimatedTimerDisplay
                seconds={
                  goalSeconds > 0
                    ? Math.max(0, goalSeconds - elapsed)
                    : elapsed
                }
                color={palette.cream}
                fontSize={80}
              />
            </Animated.View>
          )}

          {/* Running controls — interrupt + hide. Hidden when paused
              so they don't peek through the SessionEndedSheet
              backdrop while it animates in. */}
          {!paused && !awaitingFaceDown && (
            <>
              <Animated.View
                style={[
                  styles.runStopWrap,
                  { bottom: insetsBottom + 30 },
                  contentStyle,
                ]}
              >
                <View style={styles.runControlRow}>
                  <Pressable
                    onPress={onPause}
                    style={styles.runStopPill}
                    hitSlop={12}
                    accessibilityRole="button"
                    accessibilityLabel="Pause session"
                  >
                    <Text
                      style={[
                        styles.runStopLabel,
                        { fontFamily: Fonts!.serif },
                      ]}
                    >
                      pause
                    </Text>
                  </Pressable>
                  {/* Stopwatch mode has no countdown to auto-complete —
                      surface a finish pill so the user can wrap the run
                      and land on the celebration / mood / farewell flow. */}
                  {goalSeconds === 0 && (() => {
                    const canSave = elapsed >= MIN_SAVABLE_DURATION;
                    const remaining = Math.max(0, MIN_SAVABLE_DURATION - elapsed);
                    return (
                      <Pressable
                        onPress={canSave ? onFinishStopwatch : undefined}
                        disabled={!canSave}
                        style={[
                          styles.runFinishPill,
                          !canSave && styles.runFinishPillDisabled,
                        ]}
                        hitSlop={12}
                        accessibilityRole="button"
                        accessibilityLabel="Finish session"
                        accessibilityState={{ disabled: !canSave }}
                      >
                        <Text
                          style={[
                            styles.runFinishLabel,
                            { fontFamily: Fonts!.serif },
                          ]}
                        >
                          done
                        </Text>
                        {!canSave && (
                          <Text
                            style={[
                              styles.runFinishHint,
                              { fontFamily: Fonts!.mono },
                            ]}
                          >
                            {timerDisplay(remaining)}
                          </Text>
                        )}
                      </Pressable>
                    );
                  })()}
                </View>
              </Animated.View>
            </>
          )}
        </Animated.View>
      )}
    </Animated.View>
  );
}

const styles = StyleSheet.create({
  // Terracotta camera — yes button expanded to fill the screen
  // during a session. Shares the splash's positioning math. No
  // explicit zIndex: render order alone keeps it above the resting
  // content (rendered earlier as a sibling) and below the bottom
  // sheets (rendered later). An explicit zIndex here would shove
  // the camera above the SessionEndedSheet and break the manual
  // pause flow, since gorhom's HostingContainer is not absolutely
  // positioned and zIndex on its containerStyle isn't reliable.
  runCamera: {
    position: 'absolute',
  },
  runLayer: {
    position: 'absolute',
    top: 0,
    left: 0,
    right: 0,
    bottom: 0,
    alignItems: 'center',
    justifyContent: 'center',
  },
  runCenter: {
    alignItems: 'center',
    justifyContent: 'center',
  },
  // Interrupt is the primary action — substantial cream-outline
  // pill at the bottom, reachable thumb position. Wrapper carries
  // the absolute positioning so the inner Pressable can be wrapped
  // in an Animated.View without losing alignment.
  runStopWrap: {
    position: 'absolute',
    alignSelf: 'center',
    alignItems: 'center',
  },
  // Row layout for the bottom control band — interrupt sits alone in
  // countdown mode, gets a "finish" companion in stopwatch mode.
  runControlRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 12,
  },
  runStopPill: {
    minWidth: 152,
    height: 52,
    paddingHorizontal: 28,
    borderRadius: 100,
    borderWidth: 1.4,
    borderColor: 'rgba(249, 242, 224, 0.78)',
    alignItems: 'center',
    justifyContent: 'center',
  },
  runStopLabel: {
    color: palette.cream,
    fontSize: 18,
    letterSpacing: 0.6,
  },
  // Finish pill — solid cream so it reads as the primary action when
  // stopwatch mode shows both. Same height as the outline interrupt
  // pill so the row stays balanced.
  runFinishPill: {
    minWidth: 152,
    height: 52,
    paddingHorizontal: 28,
    borderRadius: 100,
    backgroundColor: palette.cream,
    alignItems: 'center',
    justifyContent: 'center',
  },
  // Below MIN_SAVABLE_DURATION: button is non-interactive and the
  // countdown hint reveals when "done" will become live. We dim with
  // opacity rather than a different fill so the visual identity stays
  // the same — the user reads it as "the same button, not yet ready".
  runFinishPillDisabled: {
    opacity: 0.4,
  },
  runFinishLabel: {
    color: palette.brown,
    fontSize: 18,
    fontWeight: '500',
    letterSpacing: 0.6,
  },
  runFinishHint: {
    color: palette.brown,
    fontSize: 11,
    fontVariant: ['tabular-nums'],
    letterSpacing: 0.5,
    marginTop: 2,
    opacity: 0.7,
  },
});
