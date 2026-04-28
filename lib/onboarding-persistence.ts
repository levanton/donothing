import type { Router } from 'expo-router';

import { useAppStore } from '@/lib/store';
import { setSetting } from '@/lib/db/settings';
import { GOAL_MINUTES } from '@/lib/onboarding-data';

/**
 * Persist onboarding answers and finish the flow.
 *
 * Throws on save failure — the caller should surface an alert and
 * leave the user on the final screen so they can retry. We must NOT
 * mark `onboardingComplete` or navigate home if persistence failed,
 * otherwise the user has no way back to set their goal/painPoints.
 */
export async function saveOnboardingData(params: {
  painPoints: string[];
  screenTime: string[];
  goal: string[];
  router: Router;
}): Promise<void> {
  if (params.painPoints.length > 0) {
    setSetting('onboarding_painPoints', JSON.stringify(params.painPoints));
  }
  if (params.screenTime.length > 0) {
    setSetting('onboarding_screenTime', params.screenTime[0]);
  }

  if (params.goal.length > 0) {
    const minutes = GOAL_MINUTES[params.goal[0]] ?? (parseInt(params.goal[0]) || 5);
    await useAppStore.getState().setDailyGoal(minutes);
  }

  useAppStore.getState().setOnboardingComplete();
  params.router.replace('/');
}
