import type { Router } from 'expo-router';

import { useAppStore } from '@/lib/store';
import { setSetting } from '@/lib/db/settings';
import { insertReminder, getAllReminders } from '@/lib/db/reminders';
import { requestPermission, syncReminders } from '@/lib/notifications';
import { GOAL_MINUTES } from '@/lib/onboarding-data';
import type { ReminderDraft } from '@/components/onboarding/screens/ScheduleScreen';

export async function saveOnboardingData(params: {
  painPoints: string[];
  screenTime: string[];
  goal: string[];
  reminders: ReminderDraft[];
  router: Router;
}): Promise<void> {
  try {
    // Save quiz answers
    if (params.painPoints.length > 0) {
      setSetting('onboarding_painPoints', JSON.stringify(params.painPoints));
    }
    if (params.screenTime.length > 0) {
      setSetting('onboarding_screenTime', params.screenTime[0]);
    }

    const enabledReminders = params.reminders.filter((r) => r.enabled);
    if (enabledReminders.length > 0) {
      setSetting('onboarding_reminderSlot', JSON.stringify(enabledReminders));
    }

    // Set daily goal
    if (params.goal.length > 0) {
      const minutes = GOAL_MINUTES[params.goal[0]] ?? (parseInt(params.goal[0]) || 5);
      await useAppStore.getState().setDailyGoal(minutes);
    }

    // Set up reminders (single permission request)
    if (enabledReminders.length > 0) {
      const status = await requestPermission();
      if (status === 'granted') {
        for (const draft of enabledReminders) {
          insertReminder(draft.hour, draft.minute, draft.weekdays);
        }
        const savedReminders = getAllReminders();
        await syncReminders(savedReminders);
        useAppStore.setState({ reminders: savedReminders });
      }
    }
  } catch (error) {
    console.error('Failed to save onboarding data:', error);
  }

  // Always mark complete and navigate — don't trap user in onboarding
  useAppStore.getState().setOnboardingComplete();
  params.router.replace('/');
}
