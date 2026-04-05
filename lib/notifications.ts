import * as Notifications from 'expo-notifications';
import { Reminder, ScheduledBlock } from './storage';

export function configureNotifications() {
  Notifications.setNotificationHandler({
    handleNotification: async () => ({
      shouldPlaySound: true,
      shouldSetBadge: false,
      shouldShowBanner: true,
      shouldShowList: true,
    }),
  });
}

export async function requestPermission(): Promise<'granted' | 'denied' | 'undetermined'> {
  const { status: existing } = await Notifications.getPermissionsAsync();
  if (existing === 'granted') return 'granted';
  if (existing === 'denied') return 'denied';
  const { status } = await Notifications.requestPermissionsAsync();
  return status === 'granted' ? 'granted' : 'denied';
}

export async function scheduleDailyNotification(
  hour: number,
  minute: number,
  title: string,
  body: string,
  data?: Record<string, unknown>,
): Promise<string> {
  return Notifications.scheduleNotificationAsync({
    content: { title, body, sound: 'default', data },
    trigger: {
      type: Notifications.SchedulableTriggerInputTypes.DAILY,
      hour,
      minute,
    },
  });
}

export async function cancelNotification(notificationId: string): Promise<void> {
  await Notifications.cancelScheduledNotificationAsync(notificationId);
}

const ALL_WEEKDAYS = [1, 2, 3, 4, 5, 6, 7];

export async function scheduleWeeklyNotification(
  hour: number,
  minute: number,
  weekday: number,
  title: string,
  body: string,
  data?: Record<string, unknown>,
): Promise<string> {
  return Notifications.scheduleNotificationAsync({
    content: { title, body, sound: 'default', data },
    trigger: {
      type: Notifications.SchedulableTriggerInputTypes.WEEKLY,
      hour,
      minute,
      weekday,
    },
  });
}

export async function syncReminders(reminders: Reminder[]): Promise<Reminder[]> {
  const updated: Reminder[] = [];
  for (const r of reminders) {
    // Cancel all existing notifications for this reminder
    if (r.notificationIds) {
      for (const nid of r.notificationIds) {
        try { await cancelNotification(nid); } catch {}
      }
    }
    // Legacy: cancel old single notificationId
    if ((r as any).notificationId) {
      try { await cancelNotification((r as any).notificationId); } catch {}
    }
    if (r.enabled) {
      const days = r.weekdays?.length ? r.weekdays : ALL_WEEKDAYS;
      const notificationIds: string[] = [];
      for (const day of days) {
        const nid = await scheduleWeeklyNotification(
          r.hour, r.minute, day,
          'Do Nothing',
          'Time to do nothing.',
          { type: 'reminder', id: r.id },
        );
        notificationIds.push(nid);
      }
      updated.push({ ...r, notificationIds });
    } else {
      updated.push({ ...r, notificationIds: undefined });
    }
  }
  return updated;
}

export async function syncScheduledBlocks(blocks: ScheduledBlock[]): Promise<ScheduledBlock[]> {
  const updated: ScheduledBlock[] = [];
  for (const b of blocks) {
    if (b.notificationIds) {
      for (const nid of b.notificationIds) {
        try { await cancelNotification(nid); } catch {}
      }
    }
    // Legacy: cancel old single notificationId
    if ((b as any).notificationId) {
      try { await cancelNotification((b as any).notificationId); } catch {}
    }
    if (b.enabled) {
      const days = b.weekdays?.length ? b.weekdays : ALL_WEEKDAYS;
      const notificationIds: string[] = [];
      for (const day of days) {
        const nid = await scheduleWeeklyNotification(
          b.hour, b.minute, day,
          'Do Nothing',
          `Screen block for ${b.durationMinutes} min starts now.`,
          { type: 'scheduledBlock', id: b.id, durationMinutes: b.durationMinutes },
        );
        notificationIds.push(nid);
      }
      updated.push({ ...b, notificationIds });
    } else {
      updated.push({ ...b, notificationIds: undefined });
    }
  }
  return updated;
}
