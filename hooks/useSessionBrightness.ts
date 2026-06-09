import { useEffect, useRef } from 'react';
import * as Brightness from 'expo-brightness';

// While a "do nothing" session runs the screen slowly dims to this level, then
// eases back up to whatever the user had when the session ends — the device
// itself relaxes with you, and wakes when you're done.
const DIM_TARGET = 0.15;
const DIM_DURATION_MS = 6000;
const RESTORE_DURATION_MS = 1400;
const STEP_MS = 80;

/**
 * Gently fades the screen brightness down when `active` turns true (session
 * start) and back up to the user's original level when it turns false.
 */
export function useSessionBrightness(active: boolean) {
  const originalRef = useRef<number | null>(null);
  const timerRef = useRef<ReturnType<typeof setInterval> | undefined>(undefined);

  useEffect(() => {
    let cancelled = false;

    const stop = () => {
      if (timerRef.current) {
        clearInterval(timerRef.current);
        timerRef.current = undefined;
      }
    };

    const animateTo = async (target: number, duration: number) => {
      stop();
      let from: number;
      try {
        from = await Brightness.getBrightnessAsync();
      } catch {
        return;
      }
      if (cancelled) return;
      const steps = Math.max(1, Math.round(duration / STEP_MS));
      let i = 0;
      timerRef.current = setInterval(() => {
        i += 1;
        const t = Math.min(1, i / steps);
        const value = from + (target - from) * t;
        Brightness.setBrightnessAsync(Math.max(0.01, Math.min(1, value))).catch(
          () => {},
        );
        if (i >= steps) stop();
      }, STEP_MS);
    };

    (async () => {
      if (active) {
        // Remember where the user had their brightness, then ease down.
        try {
          originalRef.current = await Brightness.getBrightnessAsync();
        } catch {
          originalRef.current = null;
        }
        if (!cancelled) animateTo(DIM_TARGET, DIM_DURATION_MS);
      } else if (originalRef.current != null) {
        const restore = originalRef.current;
        originalRef.current = null;
        animateTo(restore, RESTORE_DURATION_MS);
      }
    })();

    return () => {
      cancelled = true;
      stop();
    };
  }, [active]);
}
