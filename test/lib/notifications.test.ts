/**
 * lib/notifications.ts wraps expo-notifications. Tests cover the
 * orchestration logic: the in-session block-notification handler,
 * the permission-grant branches, and the reconcile loop in
 * syncScheduledBlockNotifications (cancel-then-reschedule per weekday).
 */

jest.mock('expo-notifications', () => ({
  setNotificationHandler: jest.fn(),
  getPermissionsAsync: jest.fn(),
  requestPermissionsAsync: jest.fn(),
  scheduleNotificationAsync: jest.fn(),
  cancelScheduledNotificationAsync: jest.fn(),
  SchedulableTriggerInputTypes: {
    DAILY: 'daily',
    WEEKLY: 'weekly',
    TIME_INTERVAL: 'timeInterval',
  },
}));

import * as Notifications from 'expo-notifications';
import {
  configureNotifications,
  requestPermission,
  scheduleDailyNotification,
  scheduleSessionCompleteNotification,
  cancelNotification,
} from '@/lib/notifications';

import { resetDbState } from '../db/helpers';

/**
 * syncScheduledBlockNotifications reads/writes the notification_state
 * DB. lib/notifications.ts holds module-scoped references to the DB
 * accessors, so we need to load it inside the same `jest.isolateModules`
 * call as the notifState module — otherwise after `resetDbState()` the
 * notifications side ends up holding a stale, closed connection.
 */
function loadNotificationsBundle() {
  let notifications: typeof import('@/lib/notifications');
  let notifState: typeof import('@/lib/db/notification-state');
  jest.isolateModules(() => {
    notifications = require('@/lib/notifications');
    notifState = require('@/lib/db/notification-state');
  });
  return { notifications: notifications!, notifState: notifState! };
}

const setHandler = Notifications.setNotificationHandler as jest.Mock;
const getPerms = Notifications.getPermissionsAsync as jest.Mock;
const reqPerms = Notifications.requestPermissionsAsync as jest.Mock;
const schedule = Notifications.scheduleNotificationAsync as jest.Mock;
const cancel = Notifications.cancelScheduledNotificationAsync as jest.Mock;

beforeEach(() => {
  setHandler.mockReset();
  getPerms.mockReset();
  reqPerms.mockReset();
  schedule.mockReset();
  cancel.mockReset().mockResolvedValue(undefined);
});

afterEach(resetDbState);

describe('configureNotifications handler', () => {
  function callHandler(notification: any) {
    const handlerArg = setHandler.mock.calls.at(-1)?.[0];
    return handlerArg.handleNotification(notification);
  }

  it('silences scheduled-block alerts while a session is running', async () => {
    configureNotifications({ isSessionActive: () => true });
    const result = await callHandler({
      request: { content: { data: { type: 'scheduledBlock' } } },
    });
    expect(result.shouldPlaySound).toBe(false);
    expect(result.shouldShowBanner).toBe(false);
    expect(result.shouldShowList).toBe(true); // still goes to Notification Center
  });

  it('lets non-block notifications through even during a session', async () => {
    configureNotifications({ isSessionActive: () => true });
    const result = await callHandler({
      request: { content: { data: { type: 'sessionComplete' } } },
    });
    expect(result.shouldShowBanner).toBe(true);
    expect(result.shouldPlaySound).toBe(true);
  });

  it('shows block notifications normally when no session is active', async () => {
    configureNotifications({ isSessionActive: () => false });
    const result = await callHandler({
      request: { content: { data: { type: 'scheduledBlock' } } },
    });
    expect(result.shouldShowBanner).toBe(true);
  });
});

describe('requestPermission', () => {
  it('returns granted without prompting when already granted', async () => {
    getPerms.mockResolvedValue({ status: 'granted' });
    expect(await requestPermission()).toBe('granted');
    expect(reqPerms).not.toHaveBeenCalled();
  });

  it('returns denied without prompting when already denied', async () => {
    getPerms.mockResolvedValue({ status: 'denied' });
    expect(await requestPermission()).toBe('denied');
    expect(reqPerms).not.toHaveBeenCalled();
  });

  it('prompts when undetermined and maps the result', async () => {
    getPerms.mockResolvedValue({ status: 'undetermined' });
    reqPerms.mockResolvedValue({ status: 'granted' });
    expect(await requestPermission()).toBe('granted');
  });

  it('maps any non-granted prompt outcome to denied', async () => {
    getPerms.mockResolvedValue({ status: 'undetermined' });
    reqPerms.mockResolvedValue({ status: 'undetermined' });
    expect(await requestPermission()).toBe('denied');
  });
});

describe('scheduleDailyNotification', () => {
  it('wires the DAILY trigger with the given time', async () => {
    schedule.mockResolvedValue('id-1');
    const id = await scheduleDailyNotification(9, 30, 'Title', 'Body', { type: 'x' });
    expect(id).toBe('id-1');
    expect(schedule).toHaveBeenCalledWith(
      expect.objectContaining({
        content: expect.objectContaining({ title: 'Title', body: 'Body' }),
        trigger: expect.objectContaining({ type: 'daily', hour: 9, minute: 30 }),
      }),
    );
  });
});

describe('scheduleSessionCompleteNotification', () => {
  it('pluralizes "minute" properly', async () => {
    schedule.mockResolvedValue('id-2');
    await scheduleSessionCompleteNotification(60, 1);
    expect(schedule).toHaveBeenCalledWith(
      expect.objectContaining({
        content: expect.objectContaining({ body: 'You were in silence for 1 minute.' }),
      }),
    );
    await scheduleSessionCompleteNotification(60, 5);
    expect(schedule).toHaveBeenLastCalledWith(
      expect.objectContaining({
        content: expect.objectContaining({ body: 'You were in silence for 5 minutes.' }),
      }),
    );
  });

  it('clamps the trigger to at least 1 second', async () => {
    schedule.mockResolvedValue('id-3');
    await scheduleSessionCompleteNotification(0, 1);
    const call = schedule.mock.calls[0]?.[0] as any;
    expect(call.trigger.seconds).toBe(1);
  });

  it('floors fractional seconds', async () => {
    schedule.mockResolvedValue('id-4');
    await scheduleSessionCompleteNotification(7.9, 1);
    const call = schedule.mock.calls[0]?.[0] as any;
    expect(call.trigger.seconds).toBe(7);
  });
});

describe('cancelNotification', () => {
  it('forwards the id to expo', async () => {
    await cancelNotification('xyz');
    expect(cancel).toHaveBeenCalledWith('xyz');
  });
});

describe('syncScheduledBlockNotifications', () => {
  it('schedules one weekly notification per weekday when the block is enabled', async () => {
    const { notifications, notifState } = loadNotificationsBundle();
    schedule
      .mockResolvedValueOnce('n-mon')
      .mockResolvedValueOnce('n-tue')
      .mockResolvedValueOnce('n-wed');

    await notifications.syncScheduledBlockNotifications([
      {
        id: 'b1',
        hour: 9,
        minute: 0,
        durationMinutes: 30,
        weekdays: [2, 3, 4],
        enabled: true,
        unlockGoalMinutes: 5,
      },
    ]);

    expect(schedule).toHaveBeenCalledTimes(3);
    expect(notifState.getNotificationIds('scheduledBlock', 'b1')).toEqual([
      'n-mon',
      'n-tue',
      'n-wed',
    ]);
  });

  it('cancels existing notifications before scheduling new ones', async () => {
    const { notifications, notifState } = loadNotificationsBundle();
    notifState.setNotificationIds('scheduledBlock', 'b1', ['old-1', 'old-2']);
    schedule.mockResolvedValue('new');

    await notifications.syncScheduledBlockNotifications([
      {
        id: 'b1',
        hour: 9,
        minute: 0,
        durationMinutes: 30,
        weekdays: [2],
        enabled: true,
        unlockGoalMinutes: 5,
      },
    ]);

    expect(cancel).toHaveBeenCalledWith('old-1');
    expect(cancel).toHaveBeenCalledWith('old-2');
    expect(schedule).toHaveBeenCalledTimes(1);
  });

  it('cancels and clears notifications for a disabled block, schedules nothing', async () => {
    const { notifications, notifState } = loadNotificationsBundle();
    notifState.setNotificationIds('scheduledBlock', 'b1', ['old-1']);

    await notifications.syncScheduledBlockNotifications([
      {
        id: 'b1',
        hour: 9,
        minute: 0,
        durationMinutes: 30,
        weekdays: [2, 3, 4],
        enabled: false,
        unlockGoalMinutes: 5,
      },
    ]);

    expect(cancel).toHaveBeenCalledWith('old-1');
    expect(schedule).not.toHaveBeenCalled();
    expect(notifState.getNotificationIds('scheduledBlock', 'b1')).toEqual([]);
  });

  it('tolerates cancel errors and still schedules the new notifications', async () => {
    const { notifications, notifState } = loadNotificationsBundle();
    notifState.setNotificationIds('scheduledBlock', 'b1', ['stale']);
    cancel.mockRejectedValueOnce(new Error('not found'));
    schedule.mockResolvedValue('fresh');

    await notifications.syncScheduledBlockNotifications([
      {
        id: 'b1',
        hour: 9,
        minute: 0,
        durationMinutes: 30,
        weekdays: [2],
        enabled: true,
        unlockGoalMinutes: 5,
      },
    ]);
    expect(schedule).toHaveBeenCalledTimes(1);
  });
});
