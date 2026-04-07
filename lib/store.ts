import { create } from 'zustand';
import { Alert, Linking } from 'react-native';
import * as Haptics from 'expo-haptics';
import { initDatabase } from './db';
import {
  addSession as dbAddSession,
  deleteSessionsByDateKey,
} from './db/sessions';
import {
  getAllReminders,
  insertReminder,
  updateReminder as dbUpdateReminder,
  deleteReminder as dbDeleteReminder,
  toggleReminder as dbToggleReminder,
} from './db/reminders';
import {
  getAllScheduledBlocks,
  insertScheduledBlock,
  updateScheduledBlock as dbUpdateScheduledBlock,
  deleteScheduledBlock as dbDeleteScheduledBlock,
  toggleScheduledBlock as dbToggleScheduledBlock,
} from './db/scheduled-blocks';
import { getSetting, setSetting, getDeviceState, setDeviceState } from './db/settings';
import {
  getNotificationIds,
  clearNotificationIds,
} from './db/notification-state';
import type { Reminder, ScheduledBlock } from './db/types';
import { getWeekStats, WeekDay } from './stats';
import { ThemeMode } from './theme';
import {
  configureNotifications, requestPermission,
  syncReminders, cancelNotification,
} from './notifications';

// Module-level refs (not state, not serializable)
let timerInterval: ReturnType<typeof setInterval> | null = null;
let focusInterval: ReturnType<typeof setInterval> | null = null;
let sessionStartTime = 0;
let focusEndTime = 0;

export interface AppState {
  // Timer / Session
  elapsed: number;
  started: boolean;
  weekStats: WeekDay[];
  ready: boolean;

  // Theme
  themeMode: ThemeMode;

  // Goal
  goalSeconds: number;
  showGoalSlider: boolean;
  sliderMinutes: number;

  // Focus lock
  focusStep: 'hidden' | 'pickTime' | 'active' | 'done';
  focusRemaining: number;
  focusTotal: number;

  // Settings
  settingsOpen: boolean;
  dailyGoalMinutes: number;
  reminders: Reminder[];
  scheduledBlocks: ScheduledBlock[];

  // Onboarding
  onboardingComplete: boolean;
  setOnboardingComplete: () => void;

  // Actions
  init: () => Promise<void>;
  startSession: () => void;
  stopSession: () => Promise<void>;
  resetElapsed: () => void;
  toggleTheme: () => void;

  // Goal actions
  openGoalSlider: () => void;
  cancelGoal: () => void;
  setSliderMinutes: (m: number) => void;
  setGoalFromSlider: (m: number) => void;

  // Focus actions
  openFocusPicker: () => void;
  startFocus: (seconds: number) => void;
  cancelFocus: () => void;
  unlockFocus: () => void;
  showUnlock: () => void;

  // Settings actions
  openSettings: () => void;
  closeSettings: () => void;
  setDailyGoal: (minutes: number) => Promise<void>;
  addReminder: (hour: number, minute: number, weekdays: number[]) => Promise<void>;
  editReminder: (id: string, hour: number, minute: number, weekdays: number[]) => Promise<void>;
  removeReminder: (id: string) => Promise<void>;
  toggleReminder: (id: string) => Promise<void>;
  addScheduledBlock: (hour: number, minute: number, durationMinutes: number, weekdays: number[]) => Promise<void>;
  editScheduledBlock: (id: string, hour: number, minute: number, durationMinutes: number, weekdays: number[]) => Promise<void>;
  removeScheduledBlock: (id: string) => Promise<void>;
  toggleScheduledBlock: (id: string) => Promise<void>;

  // Session actions
  deleteSessionsByDate: (dateKey: string) => Promise<void>;

  // AppState
  handleBackground: () => Promise<void>;
  handleForeground: () => void;
}

export const useAppStore = create<AppState>((set, get) => ({
  // Initial values
  elapsed: 0,
  started: false,
  weekStats: [],
  ready: false,
  themeMode: 'dark',
  goalSeconds: 0,
  showGoalSlider: false,
  sliderMinutes: 5,
  focusStep: 'hidden',
  focusRemaining: 0,
  focusTotal: 0,

  // Settings
  settingsOpen: false,
  dailyGoalMinutes: 0,
  reminders: [],
  scheduledBlocks: [],

  // Onboarding
  onboardingComplete: false,
  setOnboardingComplete: () => {
    setSetting('onboardingComplete', '1');
    set({ onboardingComplete: true });
  },

  // --- Init ---
  init: async () => {
    await initDatabase();
    configureNotifications();
    // Copy shield icon to app group (fire and forget)
    import('./screen-time').then(({ copyShieldIcon }) => copyShieldIcon()).catch(() => {});

    // Load from SQLite (synchronous reads)
    const themeMode = (getDeviceState('theme') as ThemeMode) ?? 'dark';
    const onboardingComplete = getSetting('onboardingComplete') === '1';
    const dailyGoalMinutes = Number(getSetting('dailyGoal') ?? '0');
    const reminders = getAllReminders();
    const scheduledBlocks = getAllScheduledBlocks();

    // Sync notifications (async)
    await syncReminders(reminders);

    // Re-register native scheduled blocks
    try {
      const { scheduleBlock } = await import('./screen-time');
      for (const b of scheduledBlocks) {
        if (b.enabled) {
          await scheduleBlock(b.id, 'donothing-scheduled-block', b.hour, b.minute, b.durationMinutes);
        }
      }
    } catch {}

    set({
      themeMode,
      dailyGoalMinutes,
      onboardingComplete,
      reminders,
      scheduledBlocks,
      weekStats: getWeekStats(),
      ready: true,
    });
  },

  // --- Timer ---
  startSession: () => {
    sessionStartTime = Date.now();
    set({ started: true, elapsed: 0, showGoalSlider: false });
    if (timerInterval) clearInterval(timerInterval);
    timerInterval = setInterval(() => {
      set({ elapsed: Math.floor((Date.now() - sessionStartTime) / 1000) });
    }, 1000);
  },

  stopSession: async () => {
    if (timerInterval) {
      clearInterval(timerInterval);
      timerInterval = null;
    }
    const duration = Math.floor((Date.now() - sessionStartTime) / 1000);
    set({ started: false });
    dbAddSession(duration);
    set({ weekStats: getWeekStats() });
  },

  resetElapsed: () => set({ elapsed: 0 }),

  deleteSessionsByDate: async (dateKey: string) => {
    deleteSessionsByDateKey(dateKey);
    set({ weekStats: getWeekStats() });
  },

  // --- Theme ---
  toggleTheme: () => {
    const next = get().themeMode === 'dark' ? 'light' : 'dark';
    set({ themeMode: next });
    setDeviceState('theme', next);
  },

  // --- Goal ---
  openGoalSlider: () => {
    set({ showGoalSlider: true, sliderMinutes: 5, goalSeconds: 5 * 60 });
  },

  cancelGoal: () => {
    set({ goalSeconds: 0, showGoalSlider: false });
  },

  setSliderMinutes: (m) => set({ sliderMinutes: m }),

  setGoalFromSlider: (m) => set({ goalSeconds: m * 60 }),

  // --- Focus lock ---
  openFocusPicker: () => set({ focusStep: 'pickTime' }),

  startFocus: (seconds) => {
    set({ focusTotal: seconds, focusRemaining: seconds, focusStep: 'active' });
    focusEndTime = Date.now() + seconds * 1000;
    if (focusInterval) clearInterval(focusInterval);
    focusInterval = setInterval(() => {
      const left = Math.max(0, Math.ceil((focusEndTime - Date.now()) / 1000));
      set({ focusRemaining: left });
      if (left <= 0) {
        if (focusInterval) clearInterval(focusInterval);
        focusInterval = null;
        Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success);
        set({ focusStep: 'done' });
      }
    }, 1000);
  },

  cancelFocus: () => {
    if (focusInterval) clearInterval(focusInterval);
    focusInterval = null;
    set({ focusStep: 'hidden', focusRemaining: 0 });
  },

  unlockFocus: () => {
    Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success);
    set({ focusStep: 'hidden', focusRemaining: 0 });
  },

  showUnlock: () => {
    set({ focusStep: 'done', focusRemaining: 0 });
  },

  // --- Settings ---
  openSettings: () => set({ settingsOpen: true }),
  closeSettings: () => set({ settingsOpen: false }),

  setDailyGoal: async (minutes) => {
    set({ dailyGoalMinutes: minutes });
    setSetting('dailyGoal', String(minutes));
  },

  addReminder: async (hour, minute, weekdays) => {
    const status = await requestPermission();
    if (status === 'denied') {
      Alert.alert(
        'Notifications disabled',
        'Enable notifications in Settings to receive reminders.',
        [
          { text: 'Cancel', style: 'cancel' },
          { text: 'Open Settings', onPress: () => Linking.openSettings() },
        ],
      );
      return;
    }
    if (status !== 'granted') return;
    const reminder = insertReminder(hour, minute, weekdays);
    const reminders = getAllReminders();
    await syncReminders(reminders);
    set({ reminders });
  },

  editReminder: async (id, hour, minute, weekdays) => {
    dbUpdateReminder(id, hour, minute, weekdays);
    const reminders = getAllReminders();
    await syncReminders(reminders);
    set({ reminders });
  },

  removeReminder: async (id) => {
    // Cancel notifications before deleting
    const notifIds = getNotificationIds('reminder', id);
    for (const nid of notifIds) {
      try { await cancelNotification(nid); } catch {}
    }
    clearNotificationIds('reminder', id);
    dbDeleteReminder(id);
    set({ reminders: getAllReminders() });
  },

  toggleReminder: async (id) => {
    dbToggleReminder(id);
    const reminders = getAllReminders();
    // Optimistically update UI
    set({ reminders });
    await syncReminders(reminders);
    set({ reminders: getAllReminders() });
  },

  addScheduledBlock: async (hour, minute, durationMinutes, weekdays) => {
    const block = insertScheduledBlock(hour, minute, durationMinutes, weekdays);
    try {
      const { scheduleBlock } = await import('./screen-time');
      await scheduleBlock(block.id, 'donothing-scheduled-block', hour, minute, durationMinutes);
    } catch (e) {
      console.warn('Failed to schedule native block:', e);
    }
    set({ scheduledBlocks: getAllScheduledBlocks() });
  },

  editScheduledBlock: async (id, hour, minute, durationMinutes, weekdays) => {
    try {
      const { unscheduleBlock, scheduleBlock } = await import('./screen-time');
      unscheduleBlock(id);
      await scheduleBlock(id, 'donothing-scheduled-block', hour, minute, durationMinutes);
    } catch {}
    dbUpdateScheduledBlock(id, hour, minute, durationMinutes, weekdays);
    set({ scheduledBlocks: getAllScheduledBlocks() });
  },

  removeScheduledBlock: async (id) => {
    try {
      const { unscheduleBlock } = await import('./screen-time');
      unscheduleBlock(id);
    } catch {}
    clearNotificationIds('scheduledBlock', id);
    dbDeleteScheduledBlock(id);
    set({ scheduledBlocks: getAllScheduledBlocks() });
  },

  toggleScheduledBlock: async (id) => {
    const nowEnabled = dbToggleScheduledBlock(id);
    const blocks = getAllScheduledBlocks();
    set({ scheduledBlocks: blocks });
    const block = blocks.find(b => b.id === id);
    if (block) {
      try {
        if (nowEnabled) {
          const { scheduleBlock } = await import('./screen-time');
          await scheduleBlock(id, 'donothing-scheduled-block', block.hour, block.minute, block.durationMinutes);
        } else {
          const { unscheduleBlock } = await import('./screen-time');
          unscheduleBlock(id);
        }
      } catch {}
    }
  },

  // --- AppState ---
  handleBackground: async () => {
    const { started } = get();
    if (started) {
      const duration = Math.floor((Date.now() - sessionStartTime) / 1000);
      if (timerInterval) {
        clearInterval(timerInterval);
        timerInterval = null;
      }
      set({ started: false });
      dbAddSession(duration);
    }
  },

  handleForeground: () => {
    set({ weekStats: getWeekStats() });
  },
}));
