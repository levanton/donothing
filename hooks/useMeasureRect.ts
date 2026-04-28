import { useCallback, useState, type RefObject } from 'react';
import type { View } from 'react-native';

export interface MeasuredRect {
  x: number;
  y: number;
  w: number;
  h: number;
}

/**
 * Wraps `view.measureInWindow(...)` in a hook that schedules the call
 * inside `requestAnimationFrame` (so layout has settled) and stashes
 * the result in component state. Returns the rect plus a `measure()`
 * trigger to re-run on demand (e.g. after layout changes).
 */
export function useMeasureRect(ref: RefObject<View | null>): {
  rect: MeasuredRect | null;
  measure: () => void;
} {
  const [rect, setRect] = useState<MeasuredRect | null>(null);

  const measure = useCallback(() => {
    requestAnimationFrame(() => {
      ref.current?.measureInWindow((x, y, w, h) => {
        // Guard against zero-size measurements that come back when the
        // view hasn't laid out yet — keeping the previous rect avoids
        // flashing a degenerate {0,0,0,0} into anything that animates
        // off these coords.
        if (w > 0 && h > 0) setRect({ x, y, w, h });
      });
    });
  }, [ref]);

  return { rect, measure };
}
