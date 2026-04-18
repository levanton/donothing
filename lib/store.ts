import { create } from 'zustand';
import * as Haptics from 'expo-haptics';
import { initDatabase } from './db';
import {
  addSession as dbAddSession,
  deleteSessionById as dbDeleteSession,
  deleteSessionsByDateKey,
  cleanupInvalidSessions,
} from './db/sessions';
import {
  getAllScheduledBlocks,
  insertScheduledBlock,
  updateScheduledBlock as dbUpdateScheduledBlock,
  deleteScheduledBlock as dbDeleteScheduledBlock,
  toggleScheduledBlock as dbToggleScheduledBlock,
} from './db/scheduled-blocks';
import {
  getAllBlockGroups,
} from './db/block-groups';
import { getSetting, setSetting, getDeviceState, setDeviceState } from './db/settings';
import {
  clearNotificationIds,
} from './db/notification-state';
import type { ScheduledBlock } from './db/types';
import { getWeekStats, WeekDay } from './stats';
import { ThemeMode } from './theme';
import { getAchievedMilestones } from './db/milestones-db';
import { evaluateAndSaveNewMilestones } from './milestones';
import {
  configureNotifications,
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
  scheduledBlocks: ScheduledBlock[];

  // Post-session reflection
  reflectionVisible: boolean;
  lastSessionId: string;
  lastSessionDuration: number;

  // Session completion (countdown reached 00:00)
  completionVisible: boolean;

  // Milestones
  milestoneQueue: string[];
  achievedMilestones: Map<string, number>;

  // Onboarding
  onboardingComplete: boolean;
  setOnboardingComplete: () => void;

  // Reflection actions
  showReflection: () => void;
  dismissReflection: () => void;

  // Completion actions
  completeSession: () => Promise<void>;
  dismissCompletion: () => void;

  // Milestone actions
  checkMilestones: () => void;
  dismissMilestone: () => void;

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
  addScheduledBlock: (hour: number, minute: number, durationMinutes: number, weekdays: number[], groupId: string | null, unlockGoalMinutes: number) => Promise<void>;
  editScheduledBlock: (id: string, hour: number, minute: number, durationMinutes: number, weekdays: number[], groupId: string | null, unlockGoalMinutes: number) => Promise<void>;
  removeScheduledBlock: (id: string) => Promise<void>;
  toggleScheduledBlock: (id: string) => Promise<void>;

  // Session actions
  deleteSession: (id: string) => Promise<void>;
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
  goalSeconds: 10 * 60,
  showGoalSlider: false,
  sliderMinutes: 10,
  focusStep: 'hidden',
  focusRemaining: 0,
  focusTotal: 0,

  // Post-session reflection
  reflectionVisible: false,
  lastSessionId: '',
  lastSessionDuration: 0,

  // Session completion
  completionVisible: false,

  // Milestones
  milestoneQueue: [],
  achievedMilestones: new Map(),

  // Settings
  settingsOpen: false,
  dailyGoalMinutes: 0,
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
    // Drop any sessions with bogus duration (timestamp-sized, negative, etc.)
    try { cleanupInvalidSessions(); } catch {}
    configureNotifications();
    // Copy shield icon to app group (fire and forget)
    import('./screen-time').then(({ copyShieldIcon }) => copyShieldIcon()).catch(() => {});

    // Load from SQLite (synchronous reads)
    const themeMode = (getDeviceState('theme') as ThemeMode) ?? 'dark';
    const onboardingComplete = getSetting('onboardingComplete') === '1';
    const dailyGoalMinutes = Number(getSetting('dailyGoal') ?? '0');
    const scheduledBlocks = getAllScheduledBlocks();

    // Reconcile native monitors with DB state, then re-register what's valid.
    try {
      const { reconcileBlocks, scheduleBlock } = await import('./screen-time');
      const validIds = new Set(scheduledBlocks.filter((b) => b.enabled).map((b) => b.id));
      const groupIds = getAllBlockGroups().map((g) => g.id);
      await reconcileBlocks(validIds, groupIds);
      for (const b of scheduledBlocks) {
        if (b.enabled) {
          await scheduleBlock(b.id, b.groupId, b.hour, b.minute, b.durationMinutes, b.unlockGoalMinutes);
        }
      }
    } catch {}

    // Load milestones
    const achievedMilestones = getAchievedMilestones();

    set({
      themeMode,
      dailyGoalMinutes,
      onboardingComplete,
      scheduledBlocks,
      achievedMilestones,
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
    const session = dbAddSession(duration);
    set({
      started: false,
      weekStats: getWeekStats(),
      lastSessionId: session?.id ?? '',
      lastSessionDuration: duration,
    });
    get().showReflection();
    get().checkMilestones();
  },

  resetElapsed: () => set({ elapsed: 0 }),

  // --- Reflection ---
  showReflection: () => {
    if (get().lastSessionDuration >= 10) {
      set({ reflectionVisible: true });
    }
  },

  dismissReflection: () => {
    set({ reflectionVisible: false });
    // Check milestones after reflection
    get().checkMilestones();
  },

  // --- Completion (countdown reached 00:00) ---
  completeSession: async () => {
    if (!get().started) return;
    if (timerInterval) {
      clearInterval(timerInterval);
      timerInterval = null;
    }
    const duration = Math.floor((Date.now() - sessionStartTime) / 1000);
    const session = dbAddSession(duration);
    Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success);
    set({
      started: false,
      elapsed: 0,
      weekStats: getWeekStats(),
      lastSessionId: session?.id ?? '',
      lastSessionDuration: duration,
      completionVisible: true,
    });
  },

  dismissCompletion: () => {
    set({ completionVisible: false });
    get().checkMilestones();
  },

  // --- Milestones ---
  checkMilestones: () => {
    const newIds = evaluateAndSaveNewMilestones();
    if (newIds.length > 0) {
      set({
        milestoneQueue: newIds,
        achievedMilestones: getAchievedMilestones(),
      });
    }
  },

  dismissMilestone: () => {
    const queue = get().milestoneQueue.slice(1);
    set({ milestoneQueue: queue });
  },

  deleteSession: async (id: string) => {
    dbDeleteSession(id);
    set({ weekStats: getWeekStats() });
  },

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
    const current = get().goalSeconds > 0 ? Math.round(get().goalSeconds / 60) : 10;
    set({ showGoalSlider: true, sliderMinutes: current });
  },

  cancelGoal: () => {
    set({ showGoalSlider: false });
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

  addScheduledBlock: async (hour, minute, durationMinutes, weekdays, groupId, unlockGoalMinutes) => {
    const block = insertScheduledBlock(hour, minute, durationMinutes, weekdays, groupId, unlockGoalMinutes);
    try {
      const { scheduleBlock } = await import('./screen-time');
      await scheduleBlock(block.id, groupId, hour, minute, durationMinutes, unlockGoalMinutes);
    } catch (e) {
      console.warn('Failed to schedule native block:', e);
    }
    set({ scheduledBlocks: getAllScheduledBlocks() });
  },

  editScheduledBlock: async (id, hour, minute, durationMinutes, weekdays, groupId, unlockGoalMinutes) => {
    try {
      const { unscheduleBlock, scheduleBlock } = await import('./screen-time');
      unscheduleBlock(id);
      await scheduleBlock(id, groupId, hour, minute, durationMinutes, unlockGoalMinutes);
    } catch {}
    dbUpdateScheduledBlock(id, hour, minute, durationMinutes, weekdays, groupId, unlockGoalMinutes);
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
          await scheduleBlock(id, block.groupId, block.hour, block.minute, block.durationMinutes, block.unlockGoalMinutes);
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
      const session = dbAddSession(duration);
      set({
        started: false,
        weekStats: getWeekStats(),
        lastSessionId: session?.id ?? '',
        lastSessionDuration: duration,
      });
      get().checkMilestones();
    }
  },

  handleForeground: () => {
    set({ weekStats: getWeekStats() });
  },
}));
