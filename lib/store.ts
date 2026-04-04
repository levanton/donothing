import { create } from 'zustand';
import * as Haptics from 'expo-haptics';
import { loadSessions, addSession, loadTheme, saveTheme, Session } from './storage';
import { getWeekStats, WeekDay } from './stats';
import { ThemeMode } from './theme';

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

  // --- Init ---
  init: async () => {
    const [sessions, themeMode] = await Promise.all([
      loadSessions(),
      loadTheme(),
    ]);
    set({
      sessions,
      themeMode,
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
