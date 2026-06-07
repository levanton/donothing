import { FadeIn, FadeOut, withTiming } from 'react-native-reanimated';
import { EASE_IN_OUT } from '@/constants/animations';

// Two reusable transitions for onboarding pages. Each screen picks one
// pair (enter + exit) in the registry — no per-screen logic in the route.

// Default: soft cross-fade.
export const fadeEnter = FadeIn.duration(800);
export const fadeExit = FadeOut.duration(800);

// Story screens: gentle horizontal drift ("page-flip"), small offset so the
// page emerges into view rather than flying in from the edge.
const SLIDE_OFFSET = 60;

export function slideEnter() {
  'worklet';
  return {
    initialValues: { transform: [{ translateX: SLIDE_OFFSET }], opacity: 0 },
    animations: {
      transform: [{ translateX: withTiming(0, { duration: 1300, easing: EASE_IN_OUT }) }],
      opacity: withTiming(1, { duration: 1300, easing: EASE_IN_OUT }),
    },
  };
}

export function slideExit() {
  'worklet';
  return {
    initialValues: { transform: [{ translateX: 0 }], opacity: 1 },
    animations: {
      transform: [{ translateX: withTiming(-SLIDE_OFFSET, { duration: 800, easing: EASE_IN_OUT }) }],
      opacity: withTiming(0, { duration: 800, easing: EASE_IN_OUT }),
    },
  };
}
