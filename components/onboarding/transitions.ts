import { FadeIn, FadeOut } from 'react-native-reanimated';

// Page-level transition for onboarding screens (and the story acts): a
// soft, calm cross-fade, no directional movement.
export const fadeEnter = FadeIn.duration(1200);
export const fadeExit = FadeOut.duration(1200);
