import { create } from 'zustand';
import { haptics } from '@/lib/haptics';
import { initDatabase } from './db';
import {
  addSession as dbAddSession,
  deleteSessionById as dbDeleteSession,
  deleteSessionsByDateKey,
  cleanupInvalidSessions,
  updateSessionMood as dbUpdateSessionMood,
  MIN_SAVABLE_DURATION,
} from './db/sessions';
import {
  getAllScheduledBlocks,
  getScheduledBlockById,
  insertScheduledBlock,
  updateScheduledBlock as dbUpdateScheduledBlock,
  deleteScheduledBlock as dbDeleteScheduledBlock,
  toggleScheduledBlock as dbToggleScheduledBlock,
} from './db/scheduled-blocks';
import { getSetting, setSetting, getDeviceState, setDeviceState, deleteDeviceState } from './db/settings';
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
  scheduleSessionCompleteNotification,
  cancelNotification,
} from './notifications';
import type { SubscriptionStatus } from './subscription';

// Module-level refs (not state, not serializable)
let timerInterval: ReturnType<typeof setInterval> | null = null;
let focusInterval: ReturnType<typeof setInterval> | null = null;
let sessionStartTime = 0;
let focusEndTime = 0;
let sessionNotificationId: string | null = null;

// Hot-reload safety: in dev, FastRefresh re-evaluates this module
// and the old intervals stay alive in the global runtime, ticking
// forever and double-firing setState. Stash live IDs on globalThis
// so the new module instance can sweep them on init.
if (__DEV__) {
  const g = globalThis as { __doNothingIntervals?: ReturnType<typeof setInterval>[] };
  if (g.__doNothingIntervals) {
    for (const id of g.__doNothingIntervals) {
      try { clearInterval(id); } catch { /* already cleared */ }
    }
  }
  g.__doNothingIntervals = [];
}
function trackInterval(id: ReturnType<typeof setInterval>): void {
  if (__DEV__) {
    const g = globalThis as { __doNothingIntervals?: ReturnType<typeof setInterval>[] };
    g.__doNothingIntervals?.push(id);
  }
}

// Strip native DeviceActivity monitors when entitlement lapses. SQLite
// `enabled` flag is left untouched — that's the user intent we restore
// on renewal. Pairs with `restoreAllBlocksAfterRenewal`.
async function pauseAllBlocksForExpiry(blocks: ScheduledBlock[]): Promise<void> {
  try {
    const { unscheduleBlock, forceUnblockAll } = await import('./screen-time');
    for (const b of blocks) {
      if (b.enabled) {
        try {
          unscheduleBlock(b.id);
        } catch (e) {
          console.error('[store] pauseAllBlocksForExpiry unschedule failed:', b.id, e);
        }
      }
    }
    // Safety net for the case where a shield is currently up — drop it
    // so the user isn't stuck behind a paywalled block.
    await forceUnblockAll();
  } catch (e) {
    console.error('[store] pauseAllBlocksForExpiry failed:', e);
  }
}

// Re-register native DeviceActivity monitors for every `enabled` block.
// Called on `unknown→active` (cold start with active entitlement, where
// native side may have self-cleaned during an offline lapse) and on
// `inactive→active` (purchase / restore).
async function restoreAllBlocksAfterRenewal(blocks: ScheduledBlock[]): Promise<void> {
  try {
    const { reconcileBlocks, scheduleBlock, unscheduleBlock } = await import('./screen-time');
    const validIds = new Set(blocks.filter((b) => b.enabled).map((b) => b.id));
    await reconcileBlocks(validIds);
    for (const b of blocks) {
      if (b.enabled) {
        unscheduleBlock(b.id);
        await scheduleBlock(b.id, b.hour, b.minute, b.durationMinutes, b.weekdays, b.unlockGoalMinutes);
      }
    }
  } catch (e) {
    console.error('[store] restoreAllBlocksAfterRenewal failed:', e);
  }
}

const PENDING_SESSION_KEY = 'session_pending';
const SESSION_CANCELLED_KEY = 'session_cancelled';

interface PendingSession {
  startedAt: number;
  goalSeconds: number;
  notificationId: string | null;
}

// Validate untrusted JSON from device_state — partially-written records
// (mid-crash) can leave fields undefined, and downstream code (e.g.
// cancelNotification) crashes if notificationId isn't string|null.
function isPendingSession(x: unknown): x is PendingSession {
  if (!x || typeof x !== 'object') return false;
  const o = x as Record<string, unknown>;
  return (
    typeof o.startedAt === 'number' &&
    Number.isFinite(o.startedAt) &&
    typeof o.goalSeconds === 'number' &&
    Number.isFinite(o.goalSeconds) &&
    (o.notificationId === null || typeof o.notificationId === 'string')
  );
}

function writePendingSession(p: PendingSession): void {
  try {
    setDeviceState(PENDING_SESSION_KEY, JSON.stringify(p));
  } catch (e) {
    // Disk full or DB locked — without this the cold-start recovery
    // can't tell a session was running. Log so it's at least visible.
    console.error('[store] writePendingSession failed:', e);
  }
}

function readPendingSession(): PendingSession | null {
  try {
    const raw = getDeviceState(PENDING_SESSION_KEY);
    if (!raw) return null;
    const parsed: unknown = JSON.parse(raw);
    return isPendingSession(parsed) ? parsed : null;
  } catch (e) {
    console.error('[store] readPendingSession failed:', e);
    return null;
  }
}

function clearPendingSession(): void {
  try { deleteDeviceState(PENDING_SESSION_KEY); } catch {
    // Best-effort cleanup; orphan record is harmless until next write.
  }
}

export interface AppState {
  // Timer / Session
  elapsed: number;
  started: boolean;
  // True while a manual interrupt sheet is open and the user is
  // deciding whether to continue or end. The timer interval is
  // cleared but `started` stays true so the camera keeps the
  // running visual state behind the sheet.
  paused: boolean;
  // 'block' when the session came from a scheduled-block unlock flow
  // (apps locked until the timer completes); 'normal' otherwise.
  // Drives the pause sheet's third action — "back home" vs
  // "unlock now" — so the user always has the right out.
  sessionOrigin: 'normal' | 'block';
  weekStats: WeekDay[];
  ready: boolean;

  // Theme
  themeMode: ThemeMode;

  // Subscription — gates premium features (Settings, Journey, etc.)
  // `subscriptionStatus` is source of truth; `isSubscribed` is kept as a
  // derived field for legacy read-sites and equals `status === 'active'`.
  // While status is `'unknown'` (before first RC resolve) UI should avoid
  // showing paywall to prevent flicker.
  subscriptionStatus: SubscriptionStatus;
  isSubscribed: boolean;

  // Win-back promo offer shown after the user closes the main paywall
  promoOfferVisible: boolean;
  showPromoOffer: () => void;
  hidePromoOffer: () => void;
  // Set when paywall is dismissed without purchase — home screen
  // consumes this once its launch splash settles, so the modal doesn't
  // animate in on top of the still-running splash.
  pendingPromoOnHome: boolean;
  setPendingPromoOnHome: (v: boolean) => void;

  // Goal
  goalSeconds: number;
  sliderMinutes: number;

  // Focus lock
  focusStep: 'hidden' | 'pickTime' | 'active' | 'done';
  focusRemaining: number;
  focusTotal: number;

  // Settings
  settingsOpen: boolean;
  dailyGoalMinutes: number;
  scheduledBlocks: ScheduledBlock[];

  // Last session metadata (used by SessionCompleteScreen)
  lastSessionId: string;
  lastSessionDuration: number;

  // Session completion (countdown reached 00:00)
  completionVisible: boolean;

  // Milestones (data only — no overlay UI)
  achievedMilestones: Map<string, number>;

  // Session interruption
  sessionEndedVisible: boolean;
  // 'manual' = the user pressed interrupt OR backgrounded the app
  // (handleBackground delegates to pauseSession). null = no active
  // pause; sheet shouldn't render.
  cancelReason: 'manual' | null;
  // Seconds elapsed at the moment a session was paused. Drives the
  // SessionEndedSheet's hero number.
  interruptedDuration: number | null;

  // Onboarding
  onboardingComplete: boolean;
  setOnboardingComplete: () => void;

  // Completion actions
  completeSession: () => Promise<void>;
  dismissCompletion: () => void;

  // Milestone actions
  checkMilestones: () => void;

  // Interruption actions
  dismissSessionEnded: () => void;

  // Actions
  init: () => Promise<void>;
  startSession: (opts?: { fromBlock?: boolean }) => void;
  stopSession: () => Promise<void>;
  // Manual interrupt — pause the timer without saving so the user
  // can decide (continue, start over, or end).
  pauseSession: () => void;
  // Resume a paused session, picking up from the frozen elapsed.
  resumeSession: () => void;
  // Save what's elapsed so far + reset the same session to 0 and
  // keep running. Used from the interrupt sheet's "start over".
  restartSession: () => void;
  resetElapsed: () => void;
  toggleTheme: () => void;
  setSubscriptionStatus: (next: SubscriptionStatus) => void;

  // Goal actions
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
  addScheduledBlock: (hour: number, minute: number, durationMinutes: number, weekdays: number[], unlockGoalMinutes: number) => Promise<void>;
  editScheduledBlock: (id: string, hour: number, minute: number, durationMinutes: number, weekdays: number[], unlockGoalMinutes: number) => Promise<void>;
  removeScheduledBlock: (id: string) => Promise<void>;
  toggleScheduledBlock: (id: string) => Promise<void>;

  // Session actions
  deleteSession: (id: string) => Promise<void>;
  deleteSessionsByDate: (dateKey: string) => Promise<void>;
  // Persists the picked mood for a session AND bumps weekStats so
  // ActivityCalendar's session-list memo re-runs and the new mood
  // shows up immediately (otherwise it only appeared after a cold
  // restart).
  updateSessionMood: (id: string, mood: string) => void;

  // AppState
  handleBackground: () => Promise<void>;
  handleForeground: () => void;
}

export const useAppStore = create<AppState>((set, get) => ({
  // Initial values
  elapsed: 0,
  started: false,
  paused: false,
  sessionOrigin: 'normal',
  weekStats: [],
  ready: false,
  themeMode: 'dark',
  subscriptionStatus: 'unknown',
  isSubscribed: false,
  goalSeconds: 10 * 60,
  sliderMinutes: 10,
  focusStep: 'hidden',
  focusRemaining: 0,
  focusTotal: 0,

  // Last session metadata
  lastSessionId: '',
  lastSessionDuration: 0,

  // Session completion
  completionVisible: false,

  // Milestones (data only — no overlay UI)
  achievedMilestones: new Map(),

  // Session interruption
  sessionEndedVisible: false,
  cancelReason: null,
  interruptedDuration: null,

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
    try {
      cleanupInvalidSessions();
    } catch (e) {
      console.error('[store.init] cleanupInvalidSessions failed:', e);
    }
    configureNotifications({
      // Mute scheduled-block banners while a session is running or paused
      // — the native shield still works in the background, but we don't
      // want a banner sliding in over the timer / pause sheet.
      isSessionActive: () => {
        const s = get();
        return s.started || s.paused;
      },
    });
    // Copy shield icon to app group (fire and forget — cosmetic; missing
    // icon falls back to system shield).
    import('./screen-time')
      .then(({ copyShieldIcon }) => copyShieldIcon())
      .catch((e) => console.error('[store.init] copyShieldIcon failed:', e));

    // Load from SQLite (synchronous reads)
    const themeMode = (getDeviceState('theme') as ThemeMode) ?? 'dark';
    const onboardingComplete = getSetting('onboardingComplete') === '1';
    const dailyGoalMinutes = Number(getSetting('dailyGoal') ?? '0');
    const scheduledBlocks = getAllScheduledBlocks();

    // Capture native shield state BEFORE we touch any monitors. The
    // reconcile/reschedule loop below stops and re-registers monitors;
    // when a monitor is currently inside its active window, `scheduleBlock`
    // skips re-registration (to avoid double-firing intervalDidStart),
    // which can leave the native side without an active monitor and let
    // `enableBlockAllMode` flip off — the shield then visually drops on
    // the next reconcile pass even though the user never unlocked.
    // We mirror the pre-reconcile shield state into focusStep here so
    // the BlockSheet shows on cold start regardless of what happens to
    // the native shield during reconciliation.
    let wasShieldActive = false;
    try {
      const { isBlockActive } = await import('./screen-time');
      wasShieldActive = isBlockActive();
    } catch (e) {
      console.error('[store.init] isBlockActive probe failed:', e);
    }

    // Reconcile native monitors with DB state, then re-register what's valid.
    try {
      const { reconcileBlocks, scheduleBlock, unscheduleBlock } = await import('./screen-time');
      const validIds = new Set(scheduledBlocks.filter((b) => b.enabled).map((b) => b.id));
      await reconcileBlocks(validIds);
      for (const b of scheduledBlocks) {
        if (b.enabled) {
          // Clear any stale monitors (legacy single-name or per-weekday)
          // before re-registering. Handles upgrades from older naming
          // conventions and keeps the native monitor set aligned with DB.
          unscheduleBlock(b.id);
          await scheduleBlock(b.id, b.hour, b.minute, b.durationMinutes, b.weekdays, b.unlockGoalMinutes);
        }
      }
    } catch (e) {
      // Reconcile failure means scheduled blocks may not fire. The user
      // sees them in Settings but they're effectively dead until next
      // foreground. Surface in console at minimum.
      console.error('[store.init] reconcile scheduled blocks failed:', e);
    }

    // Load milestones
    const achievedMilestones = getAchievedMilestones();

    // Cold-start: a pending session means the previous app process was
    // killed mid-session (manual force-quit, OOM, OS reboot). The
    // recovery sheet was intentionally removed — but we still want to
    // preserve what the user did. Save the elapsed slice silently if
    // it's plausible (1s ≤ elapsed; capped at MAX_SESSION_DURATION inside
    // dbAddSession, and at goal+25% if a finite goal was set).
    const pending = readPendingSession();
    if (pending) {
      const elapsedMs = Date.now() - pending.startedAt;
      const elapsedSec = Math.floor(elapsedMs / 1000);
      const goal = pending.goalSeconds;
      // Cap finite-goal sessions at goal + 25% buffer (covers small
      // wall-clock drift); infinite-goal sessions get the standard
      // 24h ceiling enforced inside dbAddSession.
      const upperBound = goal > 0 ? Math.floor(goal * 1.25) : Infinity;
      if (elapsedSec >= 1 && elapsedSec <= upperBound) {
        try {
          dbAddSession(elapsedSec);
        } catch (e) {
          console.error('[store.init] cold-start partial save failed:', e);
        }
      }
      if (pending.notificationId) {
        try { await cancelNotification(pending.notificationId); } catch {
          // Best-effort — the notification may have already fired.
        }
      }
      clearPendingSession();
    }
    try { deleteDeviceState(SESSION_CANCELLED_KEY); } catch {
      // Best-effort cleanup of legacy key.
    }

    set({
      themeMode,
      dailyGoalMinutes,
      onboardingComplete,
      scheduledBlocks,
      achievedMilestones,
      weekStats: getWeekStats(),
      sessionEndedVisible: false,
      cancelReason: null,
      // If the shield was already up when we cold-started, surface the
      // BlockSheet immediately — even if reconcile happened to drop the
      // native shield as a side effect, the user's intent (apps blocked,
      // need to unlock) is unchanged.
      focusStep: wasShieldActive ? 'done' : 'hidden',
      ready: true,
    });
  },

  // --- Timer ---
  startSession: (opts) => {
    sessionStartTime = Date.now();
    const goalSeconds = get().goalSeconds;
    set({
      started: true,
      elapsed: 0,
      sessionOrigin: opts?.fromBlock ? 'block' : 'normal',
    });
    if (timerInterval) clearInterval(timerInterval);
    timerInterval = setInterval(() => {
      set({ elapsed: Math.floor((Date.now() - sessionStartTime) / 1000) });
    }, 1000);
    trackInterval(timerInterval);
    // Schedule completion notification only for countdown sessions.
    sessionNotificationId = null;
    if (goalSeconds > 0) {
      scheduleSessionCompleteNotification(goalSeconds, Math.round(goalSeconds / 60))
        .then((id) => {
          sessionNotificationId = id;
          writePendingSession({
            startedAt: sessionStartTime,
            goalSeconds,
            notificationId: id,
          });
        })
        .catch(() => {
          writePendingSession({ startedAt: sessionStartTime, goalSeconds, notificationId: null });
        });
    } else {
      writePendingSession({ startedAt: sessionStartTime, goalSeconds: 0, notificationId: null });
    }
  },

  stopSession: async () => {
    if (timerInterval) {
      clearInterval(timerInterval);
      timerInterval = null;
    }
    if (sessionNotificationId) {
      try { await cancelNotification(sessionNotificationId); } catch {}
      sessionNotificationId = null;
    }
    clearPendingSession();
    // Use displayed elapsed instead of (Date.now() - sessionStartTime)
    // so paused sessions save the frozen value, not real-time-since-
    // start (which would over-count by the pause duration).
    const duration = get().elapsed;
    let session = null;
    try {
      session = dbAddSession(duration);
    } catch (e) {
      // Don't let a write failure leave the UI in a "stopped but still
      // started" zombie state — log and reset the timer state anyway.
      console.error('[store.stopSession] dbAddSession failed:', e);
    }
    set({
      started: false,
      paused: false,
      sessionOrigin: 'normal',
      weekStats: getWeekStats(),
      lastSessionId: session?.id ?? '',
      lastSessionDuration: duration,
      // Same reason as completeSession — make the next tap start from the
      // slider's visible value, not whatever the last block session set.
      goalSeconds: get().sliderMinutes * 60,
    });
    get().checkMilestones();
  },

  pauseSession: () => {
    if (!get().started || get().paused) return;
    if (timerInterval) {
      clearInterval(timerInterval);
      timerInterval = null;
    }
    // Cancel the scheduled completion notification — its trigger
    // time was set at session-start and would fire mid-pause,
    // notifying the user that a session "ended" while they're still
    // deciding what to do. Will be rescheduled on resume.
    if (sessionNotificationId) {
      cancelNotification(sessionNotificationId).catch(() => {});
      sessionNotificationId = null;
    }
    // Open the SessionEndedSheet (gorhom) in 'manual' mode — the
    // sheet is what surfaces continue / start over / back home.
    // The session itself stays alive (started: true) so resume can
    // pick up from the frozen elapsed.
    set({
      paused: true,
      sessionEndedVisible: true,
      cancelReason: 'manual',
      interruptedDuration: get().elapsed,
    });
  },

  resumeSession: () => {
    if (!get().started || !get().paused) return;
    // Re-anchor sessionStartTime to the frozen elapsed so the next
    // interval tick continues from where we paused.
    const elapsed = get().elapsed;
    sessionStartTime = Date.now() - elapsed * 1000;
    if (timerInterval) clearInterval(timerInterval);
    timerInterval = setInterval(() => {
      set({ elapsed: Math.floor((Date.now() - sessionStartTime) / 1000) });
    }, 1000);
    trackInterval(timerInterval);
    set({ paused: false });
    // Re-schedule the completion notification for the remaining time
    // (countdown sessions only). Without this, a paused-then-resumed
    // session would silently complete in-app with no system alert.
    const goalSeconds = get().goalSeconds;
    if (goalSeconds > 0) {
      const remaining = Math.max(1, goalSeconds - elapsed);
      const remainingMin = Math.max(1, Math.round(remaining / 60));
      scheduleSessionCompleteNotification(remaining, remainingMin)
        .then((id) => {
          sessionNotificationId = id;
          writePendingSession({
            startedAt: sessionStartTime,
            goalSeconds,
            notificationId: id,
          });
        })
        .catch(() => {
          writePendingSession({
            startedAt: sessionStartTime,
            goalSeconds,
            notificationId: null,
          });
        });
    } else {
      writePendingSession({
        startedAt: sessionStartTime,
        goalSeconds: 0,
        notificationId: null,
      });
    }
  },

  restartSession: () => {
    if (!get().started) return;
    // Cancel any pending completion notification — its scheduled
    // time is no longer valid since we're resetting elapsed to 0.
    if (sessionNotificationId) {
      cancelNotification(sessionNotificationId).catch(() => {});
      sessionNotificationId = null;
    }
    // Save what they did so far so it's not lost from history.
    const prevElapsed = get().elapsed;
    if (prevElapsed > 0) {
      try {
        dbAddSession(prevElapsed);
      } catch (e) {
        // Restart proceeds even if save fails — losing one segment is
        // better than blocking the user from starting a fresh session.
        console.error('[store.restartSession] dbAddSession failed:', e);
      }
    }
    // Reset and (re)start the timer.
    sessionStartTime = Date.now();
    if (timerInterval) clearInterval(timerInterval);
    timerInterval = setInterval(() => {
      set({ elapsed: Math.floor((Date.now() - sessionStartTime) / 1000) });
    }, 1000);
    trackInterval(timerInterval);
    set({
      elapsed: 0,
      paused: false,
      weekStats: getWeekStats(),
    });
    // Re-write pendingSession with fresh start time.
    const goalSeconds = get().goalSeconds;
    writePendingSession({
      startedAt: sessionStartTime,
      goalSeconds,
      notificationId: null,
    });
  },

  resetElapsed: () => set({ elapsed: 0 }),

  // --- Completion (countdown reached 00:00) ---
  completeSession: async () => {
    if (!get().started) return;
    if (timerInterval) {
      clearInterval(timerInterval);
      timerInterval = null;
    }
    if (sessionNotificationId) {
      try { await cancelNotification(sessionNotificationId); } catch {}
      sessionNotificationId = null;
    }
    clearPendingSession();
    const duration = Math.floor((Date.now() - sessionStartTime) / 1000);
    // Below the threshold this isn't a session — UI guards prevent it,
    // but if anything calls completeSession through a different path
    // (background AppState, future feature) we still must NOT write a
    // false-positive row or surface the celebration screen.
    if (duration < MIN_SAVABLE_DURATION) {
      set({
        started: false,
        paused: false,
        elapsed: 0,
        sessionOrigin: 'normal',
        goalSeconds: get().sliderMinutes * 60,
      });
      return;
    }
    let session = null;
    try {
      session = dbAddSession(duration);
    } catch (e) {
      console.error('[store.completeSession] dbAddSession failed:', e);
    }
    haptics.success();
    set({
      started: false,
      elapsed: 0,
      weekStats: getWeekStats(),
      lastSessionId: session?.id ?? '',
      lastSessionDuration: duration,
      completionVisible: true,
      // Sync goal back to the slider display — block sessions override
      // goalSeconds to unlockMin*60, and without this reset a subsequent
      // normal tap would start a session at the stale block duration
      // while the UI still shows the slider's value.
      goalSeconds: get().sliderMinutes * 60,
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
      set({ achievedMilestones: getAchievedMilestones() });
    }
  },

  deleteSession: async (id: string) => {
    dbDeleteSession(id);
    set({ weekStats: getWeekStats() });
  },

  deleteSessionsByDate: async (dateKey: string) => {
    deleteSessionsByDateKey(dateKey);
    set({ weekStats: getWeekStats() });
  },

  updateSessionMood: (id, mood) => {
    dbUpdateSessionMood(id, mood);
    // weekStats doubles as the journey-list refresh trigger — bumping
    // it forces ActivityCalendar's selectedSessions memo to re-read
    // and pick up the newly persisted mood.
    set({ weekStats: getWeekStats() });
  },

  // --- Theme ---
  toggleTheme: () => {
    const next = get().themeMode === 'dark' ? 'light' : 'dark';
    set({ themeMode: next });
    setDeviceState('theme', next);
  },

  setSubscriptionStatus: async (next: SubscriptionStatus) => {
    const prev = get().subscriptionStatus;
    if (prev === next) return;
    set({ subscriptionStatus: next, isSubscribed: next === 'active' });

    // Transition side-effects: keep native DeviceActivity monitors aligned
    // with entitlement state so a lapsed subscription doesn't keep firing
    // shields, and a renewal restores everything the user had.
    try {
      if (prev === 'active' && next === 'inactive') {
        await pauseAllBlocksForExpiry(get().scheduledBlocks);
      } else if (next === 'active') {
        // unknown→active or inactive→active. Either way, native side may
        // have stopped monitors (StoreKit-guard self-cleanup during a
        // lapsed period), so re-register from DB intent.
        await restoreAllBlocksAfterRenewal(get().scheduledBlocks);
      } else if (prev === 'unknown' && next === 'inactive') {
        // Defensive cleanup on cold start for non-subscribed users —
        // catches legacy / pre-gating monitors that may still exist.
        try {
          const { forceUnblockAll } = await import('./screen-time');
          await forceUnblockAll();
        } catch (e) {
          console.error('[store.setSubscriptionStatus] forceUnblockAll failed:', e);
        }
      }
    } catch (e) {
      console.error('[store.setSubscriptionStatus] transition failed:', e);
    }
  },

  promoOfferVisible: false,
  showPromoOffer: () => set({ promoOfferVisible: true }),
  hidePromoOffer: () => set({ promoOfferVisible: false }),
  pendingPromoOnHome: false,
  setPendingPromoOnHome: (v: boolean) => set({ pendingPromoOnHome: v }),

  // --- Goal ---
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
        haptics.success();
        set({ focusStep: 'done' });
      }
    }, 1000);
    trackInterval(focusInterval);
  },

  cancelFocus: () => {
    if (focusInterval) clearInterval(focusInterval);
    focusInterval = null;
    set({ focusStep: 'hidden', focusRemaining: 0 });
  },

  unlockFocus: () => {
    haptics.success();
    set({ focusStep: 'hidden', focusRemaining: 0 });
  },

  showUnlock: () => {
    set({ focusStep: 'done', focusRemaining: 0 });
  },

  // --- Settings ---
  openSettings: () => set({ settingsOpen: true }),
  closeSettings: () => set({ settingsOpen: false }),

  setDailyGoal: async (minutes) => {
    const prev = get().dailyGoalMinutes;
    set({ dailyGoalMinutes: minutes });
    try {
      setSetting('dailyGoal', String(minutes));
    } catch (e) {
      // Roll back in-memory state so it stays in sync with disk and
      // re-throw so the caller (Settings UI / onboarding) can react.
      console.error('[store.setDailyGoal] persistence failed:', e);
      set({ dailyGoalMinutes: prev });
      throw e;
    }
  },

  addScheduledBlock: async (hour, minute, durationMinutes, weekdays, unlockGoalMinutes) => {
    const block = insertScheduledBlock(hour, minute, durationMinutes, weekdays, unlockGoalMinutes);
    try {
      const { scheduleBlock } = await import('./screen-time');
      await scheduleBlock(block.id, hour, minute, durationMinutes, weekdays, unlockGoalMinutes);
    } catch (e) {
      console.warn('Failed to schedule native block:', e);
    }
    set({ scheduledBlocks: getAllScheduledBlocks() });
  },

  editScheduledBlock: async (id, hour, minute, durationMinutes, weekdays, unlockGoalMinutes) => {
    // DB first (cheap, easy to roll back). Native registration is the
    // authoritative bit — if it fails, the user's intent didn't take
    // effect and the DB should reflect that, otherwise UI lies.
    const prev = getScheduledBlockById(id);
    dbUpdateScheduledBlock(id, hour, minute, durationMinutes, weekdays, unlockGoalMinutes);
    set({ scheduledBlocks: getAllScheduledBlocks() });
    try {
      const { unscheduleBlock, scheduleBlock } = await import('./screen-time');
      unscheduleBlock(id);
      await scheduleBlock(id, hour, minute, durationMinutes, weekdays, unlockGoalMinutes);
    } catch (e) {
      console.error('[store.editScheduledBlock] native register failed:', e);
      // Rollback DB to the pre-edit values + best-effort restore native.
      if (prev) {
        try {
          dbUpdateScheduledBlock(id, prev.hour, prev.minute, prev.durationMinutes, prev.weekdays, prev.unlockGoalMinutes);
          set({ scheduledBlocks: getAllScheduledBlocks() });
          const { scheduleBlock } = await import('./screen-time');
          await scheduleBlock(id, prev.hour, prev.minute, prev.durationMinutes, prev.weekdays, prev.unlockGoalMinutes);
        } catch (rollbackErr) {
          console.error('[store.editScheduledBlock] rollback failed:', rollbackErr);
        }
      }
      throw e;
    }
  },

  removeScheduledBlock: async (id) => {
    try {
      const { unscheduleBlock } = await import('./screen-time');
      unscheduleBlock(id);
    } catch (e) {
      // Removal proceeds even if native unschedule fails — leftover
      // native monitor without a DB row is reconciled on next init.
      console.error('[store.removeScheduledBlock] native unschedule failed:', e);
    }
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
          await scheduleBlock(id, block.hour, block.minute, block.durationMinutes, block.weekdays, block.unlockGoalMinutes);
        } else {
          const { unscheduleBlock } = await import('./screen-time');
          unscheduleBlock(id);
        }
      } catch (e) {
        console.error('[store.toggleScheduledBlock] native sync failed:', e);
      }
    }
  },

  // --- Interruption handling ---
  dismissSessionEnded: () => {
    try { deleteDeviceState(SESSION_CANCELLED_KEY); } catch {}
    set({
      sessionEndedVisible: false,
      cancelReason: null,
      interruptedDuration: null,
    });
  },

  // --- AppState ---
  handleBackground: async () => {
    const { started, paused } = get();
    // Skip when not running, or when the user has already paused — the
    // manual sheet is already showing, no need to re-trigger.
    if (!started || paused) return;
    // Treat a background trip the same as tapping interrupt: freeze the
    // timer and surface the SessionEndedSheet so the user comes back to
    // continue / start over / end instead of a silent kill.
    get().pauseSession();
  },

  handleForeground: () => {
    set({ weekStats: getWeekStats() });
    // Re-anchor the focus timer. iOS aggressively pauses JS intervals
    // while backgrounded, and a manual clock change (or DST flip) can
    // leave focusRemaining stale. Recompute from focusEndTime so the
    // visible countdown matches reality when the user comes back.
    if (get().focusStep === 'active' && focusEndTime > 0) {
      const left = Math.max(0, Math.ceil((focusEndTime - Date.now()) / 1000));
      if (left <= 0) {
        if (focusInterval) clearInterval(focusInterval);
        focusInterval = null;
        set({ focusRemaining: 0, focusStep: 'done' });
      } else {
        set({ focusRemaining: left });
      }
    }
  },
}));
