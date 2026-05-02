import type { Router } from 'expo-router';

import { useAppStore } from '@/lib/store';
import { setSetting } from '@/lib/db/settings';

/**
 * Persist onboarding answers and finish the flow.
 *
 * Throws on save failure — the caller should surface an alert and
 * leave the user on the final screen so they can retry. We must NOT
 * mark `onboardingComplete` or navigate home if persistence failed,
 * otherwise the user has no way back to set their painPoints.
 */
export async function saveOnboardingData(params: {
  painPoints: string[];
  screenTime: string[];
  router: Router;
}): Promise<void> {
  if (params.painPoints.length > 0) {
    setSetting('onboarding_painPoints', JSON.stringify(params.painPoints));
  }
  if (params.screenTime.length > 0) {
    setSetting('onboarding_screenTime', params.screenTime[0]);
  }

  useAppStore.getState().setOnboardingComplete();
  // Arm the spotlight tour for the next mount of the home screen.
  // The TutorialController consumes `tutorialPending` and calls
  // copilot's `start()` once the home is ready.
  if (!useAppStore.getState().tutorialCompleted) {
    useAppStore.getState().setTutorialPending(true);
  }
  params.router.replace('/');
}
