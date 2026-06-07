import { StyleSheet } from 'react-native';

import { Fonts } from '@/constants/theme';

/**
 * Shared typography for the narrative onboarding screens
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
    fontSize: 40,
    fontWeight: '400',
    lineHeight: 46,
    textAlign: 'left',
  },
  line: {
    fontFamily: Fonts?.serif,
    fontSize: 19,
    fontWeight: '400',
    lineHeight: 27,
    textAlign: 'left',
  },
});

/** Emphasis applied to bold body lines across the narrative screens. */
export const ONBOARDING_BODY_BOLD = { fontWeight: '600' as const };
