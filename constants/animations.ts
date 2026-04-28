import { Easing } from 'react-native-reanimated';

/**
 * Standard easing curves used across the app. We deliberately avoid
 * spring/bouncy animations — see project memory `feedback_no_bounce`.
 */
export const EASE_OUT = Easing.bezier(0.25, 0.1, 0.25, 1);
export const EASE_IN = Easing.bezier(0.42, 0, 1, 1);
export const EASE_IN_OUT = Easing.bezier(0.42, 0, 0.58, 1);

/**
 * Canonical durations (ms). Pick the closest semantic name instead of
 * sprinkling magic numbers throughout components.
 */
export const DURATIONS = {
  /** Quick UI feedback — chip taps, hint fades, collapses. */
  short: 280,
  /** Standard transitions — index switches, sheet open/close. */
  base: 320,
  /** Content fade-ins — benefits, paywall feature reveals. */
  medium: 500,
  /** Hero entrance — title scale-in, screen handoff. */
  long: 620,
  /** Mood disc / large reveal animations. */
  hero: 1300,
  /** Glow / breathing reveals on completion. */
  reveal: 1400,
} as const;

/**
 * Stagger between sequential reveals (e.g. benefit cards). Use as
 * `withDelay(staggerDelay(index), ...)`.
 */
export function staggerDelay(index: number, base: number = 130): number {
  return index * base;
}
