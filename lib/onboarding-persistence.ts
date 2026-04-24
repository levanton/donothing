import type { Router } from 'expo-router';

import { useAppStore } from '@/lib/store';
import { setSetting } from '@/lib/db/settings';
import { GOAL_MINUTES } from '@/lib/onboarding-data';

export async function saveOnboardingData(params: {
  painPoints: string[];
  screenTime: string[];
  goal: string[];
  router: Router;
}): Promise<void> {
  try {
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
  } catch (error) {
    console.error('Failed to save onboarding data:', error);
  }

  useAppStore.getState().setOnboardingComplete();
  params.router.replace('/');
}
