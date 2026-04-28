import { Gesture, type GestureType } from 'react-native-gesture-handler';
import { runOnJS, withTiming, type SharedValue } from 'react-native-reanimated';

export type SlideDirection = 'up' | 'down' | 'left' | 'right';
export type SlideMode = 'open' | 'close';

interface UseSlideGestureConfig {
  /** Shared value the pan drives — clamped to 0..1. */
  slide: SharedValue<number>;
  /** Which way the user pans to commit the action. */
  direction: SlideDirection;
  /** 'open' — slide moves 0 → 1 on commit. 'close' — slide moves 1 → 0. */
  mode: SlideMode;
  /** Screen dimension along the gesture axis (SCREEN_W for x, SCREEN_H for y). */
  unit: number;
  /** Whether the gesture is active. Default true. */
  enabled?: boolean;
  /** Pan distance (px) before the gesture activates. Default 20. */
  threshold?: number;
  /** Perpendicular pan range that fails the gesture. Default [-15, 15].
   *  Pass null to skip the perpendicular fail check entirely. */
  failPerpendicular?: [number, number] | null;
  /** Scroll gate — gesture is a no-op when scroll position exceeds the
   *  threshold. Used to coexist with embedded ScrollViews. */
  scrollGate?: { value: SharedValue<number>; threshold: number };
  /** Velocity (px/sec) that confirms the commit regardless of position.
   *  Default 500. */
  velocityThreshold?: number;
  /** Position threshold for commit. Defaults: 0.3 for open / 0.7 for close. */
  positionThreshold?: number;
  /** Snap animation duration. Default 300ms. */
  duration?: number;
  /** Optional JS callback when commit happens. */
  onCommit?: () => void;
  /** External gesture for ScrollView coexistence. */
  simultaneousWith?: GestureType;
}

/**
 * Builds a `Gesture.Pan` that drives a 0..1 SharedValue from a swipe.
 * Replaces the same hand-rolled pattern (translation → clamp → snap on
 * end with velocity) used by 4 different pan handlers in app/index.tsx
 * (open/close history vertically, open/close settings horizontally).
 */
export function useSlideGesture(config: UseSlideGestureConfig) {
  const {
    slide,
    direction,
    mode,
    unit,
    enabled = true,
    threshold = 20,
    failPerpendicular = [-15, 15] as [number, number],
    scrollGate,
    velocityThreshold = 500,
    positionThreshold = mode === 'open' ? 0.3 : 0.7,
    duration = 300,
    onCommit,
    simultaneousWith,
  } = config;

  const isVertical = direction === 'up' || direction === 'down';
  // sign: how to convert raw translation/velocity into "pulling toward
  // commit". Up & left are negative (translation goes negative when
  // pulling that way); down & right are positive.
  const sign = direction === 'up' || direction === 'left' ? -1 : 1;

  let g = Gesture.Pan().enabled(enabled);

  // Active offset — single value when pulling toward commit on the
  // primary axis, or a wide range when committing in the positive
  // direction (matches the existing `-10000, threshold` shape).
  if (isVertical) {
    g = sign < 0
      ? g.activeOffsetY(-threshold)
      : g.activeOffsetY([-10000, threshold]);
    if (failPerpendicular) g = g.failOffsetX(failPerpendicular);
  } else {
    g = sign < 0
      ? g.activeOffsetX(-threshold)
      : g.activeOffsetX([-10000, threshold]);
    if (failPerpendicular) g = g.failOffsetY(failPerpendicular);
  }

  if (simultaneousWith) {
    g = g.simultaneousWithExternalGesture(simultaneousWith);
  }

  return g
    .onUpdate((e) => {
      'worklet';
      if (scrollGate && scrollGate.value.value > scrollGate.threshold) return;
      const translation = isVertical ? e.translationY : e.translationX;
      const drag = (sign * translation) / unit;
      if (mode === 'open') {
        slide.value = Math.max(0, Math.min(1, drag));
      } else {
        slide.value = Math.max(0, Math.min(1, 1 - Math.max(0, drag)));
      }
    })
    .onEnd((e) => {
      'worklet';
      if (scrollGate && scrollGate.value.value > scrollGate.threshold) return;
      const velocity = isVertical ? e.velocityY : e.velocityX;
      const projectedVelocity = sign * velocity;
      if (mode === 'open') {
        const shouldOpen =
          slide.value > positionThreshold ||
          projectedVelocity > velocityThreshold;
        slide.value = withTiming(shouldOpen ? 1 : 0, { duration });
        if (shouldOpen && onCommit) runOnJS(onCommit)();
      } else {
        const shouldClose =
          slide.value < positionThreshold ||
          projectedVelocity > velocityThreshold;
        slide.value = withTiming(shouldClose ? 0 : 1, { duration });
        if (shouldClose && onCommit) runOnJS(onCommit)();
      }
    });
}
