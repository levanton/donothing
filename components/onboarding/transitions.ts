import { FadeIn, FadeOut, withDelay, withTiming } from 'react-native-reanimated';
import type {
  EntryAnimationsValues,
  EntryExitAnimationFunction,
  ExitAnimationsValues,
} from 'react-native-reanimated';

import { EASE_IN_OUT } from '@/constants/animations';
import { DOT_MORPH_MS, DOT_TRAVEL_FRACTION } from './dotFieldLayout';

// Page-level transition for onboarding screens: a soft, calm cross-fade,
// no directional movement.
export const fadeEnter = FadeIn.duration(1200);
export const fadeExit = FadeOut.duration(1200);

// ── Story act hand-off ────────────────────────────────────────────────────
// One stream: the old act's text, the dot field and the new act's text all
// travel upward together — same distance, same timing, same easing. The dot
// field is driven by dotProgress in StoryScreen; the two acts below ride
// along with it. The old text dissolves as it exits through the top, the
// new text emerges from the bottom glued right below the dots.
export const rideWithDotsEnter: EntryExitAnimationFunction = (
  values: EntryAnimationsValues,
) => {
  'worklet';
  const travel = values.windowHeight * DOT_TRAVEL_FRACTION;
  return {
    initialValues: {
      opacity: 0,
      transform: [{ translateY: travel }],
    },
    animations: {
      // The text materialises over the whole ride — fully visible exactly
      // when it settles below the dots.
      opacity: withTiming(1, { duration: DOT_MORPH_MS, easing: EASE_IN_OUT }),
      transform: [
        {
          translateY: withTiming(0, {
            duration: DOT_MORPH_MS,
            easing: EASE_IN_OUT,
          }),
        },
      ],
    },
  };
};

// The old text stays fully visible while it rides — its top lines slide out
// through the screen edge — and only dissolves in the second half of the
// journey, so it visibly disappears at the top, not mid-air.
const EXIT_FADE_DELAY_MS = DOT_MORPH_MS * 0.5;
const EXIT_FADE_MS = DOT_MORPH_MS - EXIT_FADE_DELAY_MS;

export const rideWithDotsExit: EntryExitAnimationFunction = (
  values: ExitAnimationsValues,
) => {
  'worklet';
  const travel = values.windowHeight * DOT_TRAVEL_FRACTION;
  return {
    initialValues: {
      opacity: 1,
      transform: [{ translateY: 0 }],
    },
    animations: {
      opacity: withDelay(
        EXIT_FADE_DELAY_MS,
        withTiming(0, { duration: EXIT_FADE_MS, easing: EASE_IN_OUT }),
      ),
      transform: [
        {
          translateY: withTiming(-travel, {
            duration: DOT_MORPH_MS,
            easing: EASE_IN_OUT,
          }),
        },
      ],
    },
  };
};
