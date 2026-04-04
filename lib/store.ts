import { create } from 'zustand';
import { Alert, Linking } from 'react-native';
import * as Haptics from 'expo-haptics';
import {
  loadSessions, addSession, loadTheme, saveTheme, Session,
  Reminder, ScheduledBlock,
  loadDailyGoal, saveDailyGoal,
  loadReminders, saveReminders,
  loadScheduledBlocks, saveScheduledBlocks,
} from './storage';
import { getWeekStats, WeekDay } from './stats';
import { ThemeMode } from './theme';
import {
  configureNotifications, requestPermission,
  syncReminders, syncScheduledBlocks, cancelNotification,
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
  sessions: Session[];
  weekStats: WeekDay[];
  ready: boolean;

  // Theme
  themeMode: ThemeMode;

  // Goal
  goalSeconds: number;
  showGoalSlider: boolean;
  sliderMinutes: number;

  // Focus lock
  focusStep: 'hidden' | 'pickTime' | 'active';
  focusRemaining: number;
  focusTotal: number;

  // Settings
  settingsOpen: boolean;
  dailyGoalMinutes: number;
  reminders: Reminder[];
  scheduledBlocks: ScheduledBlock[];

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

  // Settings actions
  openSettings: () => void;
  closeSettings: () => void;
  setDailyGoal: (minutes: number) => Promise<void>;
  addReminder: (hour: number, minute: number) => Promise<void>;
  removeReminder: (id: string) => Promise<void>;
  toggleReminder: (id: string) => Promise<void>;
  addScheduledBlock: (hour: number, minute: number, durationMinutes: number) => Promise<void>;
  removeScheduledBlock: (id: string) => Promise<void>;
  toggleScheduledBlock: (id: string) => Promise<void>;

  // AppState
  handleBackground: () => Promise<void>;
  handleForeground: () => Promise<void>;
}

export const useAppStore = create<AppState>((set, get) => ({
  // Initial values
  elapsed: 0,
  started: false,
  sessions: [],
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

  // --- Init ---
  init: async () => {
    configureNotifications();
    const [sessions, themeMode, dailyGoalMinutes, rawReminders, rawBlocks] = await Promise.all([
      loadSessions(),
      loadTheme(),
      loadDailyGoal(),
      loadReminders(),
      loadScheduledBlocks(),
    ]);
    const reminders = await syncReminders(rawReminders);
    const scheduledBlocks = await syncScheduledBlocks(rawBlocks);
    await saveReminders(reminders);
    await saveScheduledBlocks(scheduledBlocks);
    set({
      sessions,
      themeMode,
      dailyGoalMinutes,
      reminders,
      scheduledBlocks,
      weekStats: getWeekStats(sessions),
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
    const updated = await addSession(duration);
    set({ sessions: updated, weekStats: getWeekStats(updated) });
  },

  resetElapsed: () => set({ elapsed: 0 }),

  // --- Theme ---
  toggleTheme: () => {
    const next = get().themeMode === 'dark' ? 'light' : 'dark';
    set({ themeMode: next });
    saveTheme(next);
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
        set({ focusStep: 'hidden' });
      }
    }, 1000);
  },

  cancelFocus: () => {
    if (focusInterval) clearInterval(focusInterval);
    focusInterval = null;
    set({ focusStep: 'hidden', focusRemaining: 0 });
  },

  // --- Settings ---
  openSettings: () => set({ settingsOpen: true }),
  closeSettings: () => set({ settingsOpen: false }),

  setDailyGoal: async (minutes) => {
    set({ dailyGoalMinutes: minutes });
    await saveDailyGoal(minutes);
  },

  addReminder: async (hour, minute) => {
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
    const reminders = [...get().reminders, {
      id: Date.now().toString(),
      hour, minute, enabled: true,
    }];
    const synced = await syncReminders(reminders);
    set({ reminders: synced });
    await saveReminders(synced);
  },

  removeReminder: async (id) => {
    const old = get().reminders.find((r) => r.id === id);
    if (old?.notificationId) {
      try { await cancelNotification(old.notificationId); } catch {}
    }
    const reminders = get().reminders.filter((r) => r.id !== id);
    set({ reminders });
    await saveReminders(reminders);
  },

  toggleReminder: async (id) => {
    const reminders = get().reminders.map((r) =>
      r.id === id ? { ...r, enabled: !r.enabled } : r,
    );
    const synced = await syncReminders(reminders);
    set({ reminders: synced });
    await saveReminders(synced);
  },

  addScheduledBlock: async (hour, minute, durationMinutes) => {
    const status = await requestPermission();
    if (status === 'denied') {
      Alert.alert(
        'Notifications disabled',
        'Enable notifications in Settings for scheduled blocking.',
        [
          { text: 'Cancel', style: 'cancel' },
          { text: 'Open Settings', onPress: () => Linking.openSettings() },
        ],
      );
      return;
    }
    if (status !== 'granted') return;
    const blocks = [...get().scheduledBlocks, {
      id: Date.now().toString(),
      hour, minute, durationMinutes, enabled: true,
    }];
    const synced = await syncScheduledBlocks(blocks);
    set({ scheduledBlocks: synced });
    await saveScheduledBlocks(synced);
  },

  removeScheduledBlock: async (id) => {
    const old = get().scheduledBlocks.find((b) => b.id === id);
    if (old?.notificationId) {
      try { await cancelNotification(old.notificationId); } catch {}
    }
    const blocks = get().scheduledBlocks.filter((b) => b.id !== id);
    set({ scheduledBlocks: blocks });
    await saveScheduledBlocks(blocks);
  },

  toggleScheduledBlock: async (id) => {
    const blocks = get().scheduledBlocks.map((b) =>
      b.id === id ? { ...b, enabled: !b.enabled } : b,
    );
    const synced = await syncScheduledBlocks(blocks);
    set({ scheduledBlocks: synced });
    await saveScheduledBlocks(synced);
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
      const updated = await addSession(duration);
      set({ sessions: updated });
    }
  },

  handleForeground: async () => {
    const sessions = await loadSessions();
    set({ sessions, weekStats: getWeekStats(sessions) });
  },
}));
