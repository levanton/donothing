import * as Notifications from 'expo-notifications';
import type { ScheduledBlock } from './db/types';
import {
  getNotificationIds,
  setNotificationIds,
  clearNotificationIds,
} from './db/notification-state';

interface NotificationConfig {
  /** True when a session is running or paused. While this is true,
      scheduled-block notifications are kept silent (no banner, no sound)
      so they don't pop on top of the running/paused UI. They still go
      to Notification Center via `shouldShowList: true` so the user can
      check them later. */
  isSessionActive: () => boolean;
}

export function configureNotifications(opts: NotificationConfig) {
  Notifications.setNotificationHandler({
    handleNotification: async (notification) => {
      const data = notification.request.content.data;
      const isBlockNotif = data?.type === 'scheduledBlock';
      if (isBlockNotif && opts.isSessionActive()) {
        return {
          shouldPlaySound: false,
          shouldSetBadge: false,
          shouldShowBanner: false,
          shouldShowList: true,
        };
      }
      return {
        shouldPlaySound: true,
        shouldSetBadge: false,
        shouldShowBanner: true,
        shouldShowList: true,
      };
    },
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

export async function scheduleSessionCompleteNotification(
  secondsFromNow: number,
  durationMinutes: number,
): Promise<string> {
  return Notifications.scheduleNotificationAsync({
    content: {
      title: 'Do Nothing',
      body: `You were in silence for ${durationMinutes} minute${durationMinutes === 1 ? '' : 's'}.`,
      sound: 'default',
      data: { type: 'sessionComplete' },
    },
    trigger: {
      type: Notifications.SchedulableTriggerInputTypes.TIME_INTERVAL,
      seconds: Math.max(1, Math.floor(secondsFromNow)),
    },
  });
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

export async function syncScheduledBlockNotifications(blocks: ScheduledBlock[]): Promise<void> {
  for (const b of blocks) {
    const existingIds = getNotificationIds('scheduledBlock', b.id);
    for (const nid of existingIds) {
      try { await cancelNotification(nid); } catch {}
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
      setNotificationIds('scheduledBlock', b.id, notificationIds);
    } else {
      clearNotificationIds('scheduledBlock', b.id);
    }
  }
}
