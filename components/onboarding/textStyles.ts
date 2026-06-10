import { StyleSheet } from 'react-native';

import { Fonts } from '@/constants/theme';

/**
 * Shared typography for the narrative onboarding story acts
 * (nostalgia, rushing, phoneSymptom). One source of truth so the
 * heading + body voice stays consistent across the story.
 *
 * These styles cover type only (family, size, weight, line height).
 * Layout spacing — margins, gaps — stays in each screen, since the
 * screens arrange their heading/image/lines differently.
 */
export const onboardingText = StyleSheet.create({
  heading: {
    fontFamily: Fonts?.serif,
    fontSize: 37,
    fontWeight: '400',
    lineHeight: 43,
    textAlign: 'left',
  },
  line: {
    fontFamily: Fonts?.serif,
    fontSize: 20,
    fontWeight: '400',
    lineHeight: 28,
    textAlign: 'left',
  },
  /** The narrative screens' single uniform text size — no title tier. */
  story: {
    fontFamily: Fonts?.serif,
    fontSize: 24,
    fontWeight: '400',
    lineHeight: 34,
    textAlign: 'left',
  },
});

/** Emphasis applied to bold body lines across the narrative screens. */
export const ONBOARDING_BODY_BOLD = { fontWeight: '600' as const };
