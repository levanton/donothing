import { useCallback, useEffect } from 'react';
import {
  useAnimatedStyle,
  useSharedValue,
  withTiming,
} from 'react-native-reanimated';

interface UseHeaderMorphConfig {
  started: boolean;
  completionVisible: boolean;
  sessionEndedVisible: boolean;
}

/**
 * Owns the home screen's resting↔running entry visuals: the header morph
 * "Ready to Do|ing| nothing|?|" and the resting timer's 0.9→1 opacity nudge.
 *
 * - `started` flipping true plays the morph toward "Doing nothing".
 * - `completionVisible` restores the resting state with the slow timings
 *   (plays behind the completion overlay).
 * - `sessionEndedVisible` restores it instantly (a cancelled session).
 * - `resetToRest()` is the same slow restore for imperative callers
 *   (stop button, sheet end/unlock, phase→idle watcher).
 * - `snapToRunning()` jumps straight to the running state — used when a
 *   block session starts so the user doesn't see a flash of
 *   "Ready to Do nothing?" when leaving the block-waiting UI.
 */
export function useHeaderMorph({
  started,
  completionVisible,
  sessionEndedVisible,
}: UseHeaderMorphConfig) {
  const timerOpacity = useSharedValue(0.9);

  // Header morph: "Ready to Do|ing| nothing|?|"
  const hideOpacity = useSharedValue(1);
  const hideWidth = useSharedValue(1);
  const showOpacity = useSharedValue(0);
  const showWidth = useSharedValue(0);

  useEffect(() => {
    if (!started) return;
    // Timer fade — kept so the resting timer's slight 0.9 opacity
    // jumps to 1 in the brief moment before the camera covers it.
    timerOpacity.value = withTiming(1, { duration: 1125 });
    // Header text morph (still cosmetically nice even though the
    // camera covers it during the run; matters on close).
    hideOpacity.value = withTiming(0, { duration: 400 });
    hideWidth.value = withTiming(0, { duration: 860 });
    showWidth.value = withTiming(1, { duration: 690 });
    showOpacity.value = withTiming(1, { duration: 1125 });
  }, [started]);

  // --- Reset main screen visuals while completion overlay is showing ---
  useEffect(() => {
    if (!completionVisible) return;
    timerOpacity.value = withTiming(0.9, { duration: 700 });
    showOpacity.value = withTiming(0, { duration: 400 });
    showWidth.value = withTiming(0, { duration: 860 });
    hideWidth.value = withTiming(1, { duration: 690 });
    hideOpacity.value = withTiming(1, { duration: 1125 });
  }, [completionVisible]);

  // --- Reset main screen visuals when a session was cancelled ---
  useEffect(() => {
    if (!sessionEndedVisible) return;
    timerOpacity.value = 0.9;
    showOpacity.value = 0;
    showWidth.value = 0;
    hideWidth.value = 1;
    hideOpacity.value = 1;
  }, [sessionEndedVisible]);

  const resetToRest = useCallback(() => {
    timerOpacity.value = withTiming(0.9, { duration: 700 });
    showOpacity.value = withTiming(0, { duration: 400 });
    showWidth.value = withTiming(0, { duration: 860 });
    hideWidth.value = withTiming(1, { duration: 690 });
    hideOpacity.value = withTiming(1, { duration: 1125 });
  }, []);

  const snapToRunning = useCallback(() => {
    hideOpacity.value = 0;
    hideWidth.value = 0;
    showOpacity.value = 1;
    showWidth.value = 1;
  }, []);

  const timerEntryStyle = useAnimatedStyle(() => ({
    opacity: timerOpacity.value,
  }));

  // "Ready to " and "?" — fade then collapse
  const hideStyle = useAnimatedStyle(() => ({
    opacity: hideOpacity.value,
    maxWidth: hideWidth.value * 150,
    overflow: 'hidden' as const,
    height: 28,
  }));

  // "ing" — expand then fade in
  const showStyle = useAnimatedStyle(() => ({
    opacity: showOpacity.value,
    maxWidth: showWidth.value * 50,
    overflow: 'hidden' as const,
    height: 28,
  }));

  return { timerEntryStyle, hideStyle, showStyle, resetToRest, snapToRunning };
}
