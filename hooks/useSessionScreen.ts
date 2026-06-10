import { useCallback, useEffect, useRef, useState } from 'react';
import { AppState } from 'react-native';
import * as Brightness from 'expo-brightness';
import {
  Easing,
  useAnimatedStyle,
  useSharedValue,
  withTiming,
} from 'react-native-reanimated';

// One self-contained controller for the "screen goes dark while you do nothing"
// behaviour. It owns the physical brightness, the content fade, and the
// tap-to-wake state — so app/index.tsx just reads `contentStyle`, `fullyDark`
// and `wake` and wires three things in the render.
//
// Lifecycle:
//   active & !suppressed & !awake  → fade brightness + content to black.
//   …fade finishes                 → `fullyDark` true (now a tap wakes it).
//   wake() / suppressed / !active  → restore, and never re-dim until next run.
//
// While it's still fading (`!fullyDark`) the normal UI is untouched, so the
// pause button stays directly tappable. Only once fully black does the caller
// put up a tap-catcher.

// Brightness floor — dimmed, but the backlight stays visibly on. At 0 the
// screen reads as "locked/off", which users mistake for the phone dying
// mid-session; the content itself is already hidden via opacity.
const DIM_FLOOR = 0.25;
const RESTORE_MS = 480;
const CONTENT_RESTORE_MS = 500;
const MANUAL_FADE_MS = 720; // distraction-free toggle is snappy
const STEP_MS = 32;

interface Args {
  /** A session is running. */
  active: boolean;
  /** Don't dim — paused / interrupt sheet up (lock surfaces it). */
  suppressed: boolean;
  /** Manual distraction-free toggle. */
  distractionFree: boolean;
  /** Auto session fade duration (ms). */
  dimDurationMs?: number;
}

export function useSessionScreen({
  active,
  suppressed,
  distractionFree,
  dimDurationMs = 5500,
}: Args) {
  const [awake, setAwake] = useState(false);
  const [fullyDark, setFullyDark] = useState(false);

  const dark = (active && !suppressed && !awake) || distractionFree;
  const fadeMs = distractionFree ? MANUAL_FADE_MS : dimDurationMs;

  // Content (camera + timer) opacity — hidden while dark so it's truly black.
  const contentFade = useSharedValue(1);
  const contentStyle = useAnimatedStyle(() => ({ opacity: contentFade.value }));

  const savedRef = useRef<number | null>(null);
  const intervalRef = useRef<ReturnType<typeof setInterval> | null>(null);
  const fullyDarkTimer = useRef<ReturnType<typeof setTimeout> | null>(null);

  const stopBrightness = useCallback(() => {
    if (intervalRef.current) {
      clearInterval(intervalRef.current);
      intervalRef.current = null;
    }
  }, []);

  // expo-brightness has no easing, so tween it in JS.
  const animateBrightness = useCallback(
    (to: number, durationMs: number) => {
      stopBrightness();
      Brightness.getBrightnessAsync()
        .then((from) => {
          const start = Date.now();
          const tick = () => {
            const t = Math.min(1, (Date.now() - start) / durationMs);
            const eased = t < 0.5 ? 4 * t * t * t : 1 - Math.pow(-2 * t + 2, 3) / 2;
            Brightness.setBrightnessAsync(from + (to - from) * eased).catch(() => {});
            if (t >= 1) stopBrightness();
          };
          tick();
          intervalRef.current = setInterval(tick, STEP_MS);
        })
        .catch(() => {});
    },
    [stopBrightness],
  );

  // Reset wake / fully-dark whenever a session ends.
  useEffect(() => {
    if (!active) {
      setAwake(false);
      setFullyDark(false);
    }
  }, [active]);

  // The single source of truth: react to `dark`.
  useEffect(() => {
    if (fullyDarkTimer.current) {
      clearTimeout(fullyDarkTimer.current);
      fullyDarkTimer.current = null;
    }
    if (dark) {
      contentFade.value = withTiming(0, {
        duration: fadeMs,
        easing: Easing.inOut(Easing.cubic),
      });
      Brightness.getBrightnessAsync()
        .then((cur) => {
          if (savedRef.current == null) savedRef.current = cur;
          // Never *raise* brightness to reach the floor — someone already
          // below it (night use) stays where they are.
          animateBrightness(Math.min(cur, DIM_FLOOR), fadeMs);
        })
        .catch(() => {});
      fullyDarkTimer.current = setTimeout(() => setFullyDark(true), fadeMs);
    } else {
      setFullyDark(false);
      contentFade.value = withTiming(1, {
        duration: CONTENT_RESTORE_MS,
        easing: Easing.inOut(Easing.cubic),
      });
      if (savedRef.current != null) {
        const restore = savedRef.current;
        savedRef.current = null;
        animateBrightness(restore, RESTORE_MS);
      }
    }
  }, [dark, fadeMs, animateBrightness]);

  // Re-assert on foreground — JS/reanimated animations don't progress while
  // backgrounded (locking mid-fade), so snap to the correct state on return.
  useEffect(() => {
    const sub = AppState.addEventListener('change', (state) => {
      if (state !== 'active') return;
      contentFade.value = dark ? 0 : 1;
      if (dark) {
        const saved = savedRef.current;
        animateBrightness(saved != null ? Math.min(saved, DIM_FLOOR) : DIM_FLOOR, RESTORE_MS);
      } else if (savedRef.current != null) {
        const restore = savedRef.current;
        savedRef.current = null;
        animateBrightness(restore, RESTORE_MS);
      }
    });
    return () => sub.remove();
  }, [dark, animateBrightness]);

  // Restore brightness on unmount.
  useEffect(
    () => () => {
      stopBrightness();
      if (fullyDarkTimer.current) clearTimeout(fullyDarkTimer.current);
      if (savedRef.current != null) {
        Brightness.setBrightnessAsync(savedRef.current).catch(() => {});
        savedRef.current = null;
      }
    },
    [stopBrightness],
  );

  const wake = useCallback(() => setAwake(true), []);

  return { contentStyle, fullyDark, wake };
}
