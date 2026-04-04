import * as Notifications from 'expo-notifications';
import { Reminder, ScheduledBlock } from './storage';

export function configureNotifications() {
  Notifications.setNotificationHandler({
    handleNotification: async () => ({
      shouldShowAlert: true,
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

export async function syncReminders(reminders: Reminder[]): Promise<Reminder[]> {
  const updated: Reminder[] = [];
  for (const r of reminders) {
    if (r.notificationId) {
      try { await cancelNotification(r.notificationId); } catch {}
    }
    if (r.enabled) {
      const notificationId = await scheduleDailyNotification(
        r.hour, r.minute,
        'Do Nothing',
        'Time to do nothing.',
        { type: 'reminder', id: r.id },
      );
      updated.push({ ...r, notificationId });
    } else {
      updated.push({ ...r, notificationId: undefined });
    }
  }
  return updated;
}

export async function syncScheduledBlocks(blocks: ScheduledBlock[]): Promise<ScheduledBlock[]> {
  const updated: ScheduledBlock[] = [];
  for (const b of blocks) {
    if (b.notificationId) {
      try { await cancelNotification(b.notificationId); } catch {}
    }
    if (b.enabled) {
      const notificationId = await scheduleDailyNotification(
        b.hour, b.minute,
        'Do Nothing',
        `Screen block for ${b.durationMinutes} min starts now.`,
        { type: 'scheduledBlock', id: b.id, durationMinutes: b.durationMinutes },
      );
      updated.push({ ...b, notificationId });
    } else {
      updated.push({ ...b, notificationId: undefined });
    }
  }
  return updated;
}
