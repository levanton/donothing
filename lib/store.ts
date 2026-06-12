import { create } from 'zustand';
import { activateKeepAwakeAsync, deactivateKeepAwake } from 'expo-keep-awake';
import { haptics } from '@/lib/haptics';
import { sound } from '@/lib/sound';
import { initDatabase, wipeUserData } from './db';
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
import { BooleanFlagSchema } from './db/schemas';
import {
  clearNotificationIds,
} from './db/notification-state';
import type { ScheduledBlock, Session } from './db/types';
import type { MoodKey } from '@/lib/mood';
import { getWeekStats, WeekDay } from './stats';
import {
  flagsForPhase,
  isSessionSurfaceFree,
  nextPhase,
  type SessionEvent,
  type SessionPhase,
} from './session-machine';
import { ThemeMode } from './theme';
import { getAchievedMilestones } from './db/milestones-db';
import { evaluateAndSaveNewMilestones } from './milestones';
import {
  configureNotifications,
  cancelNotification,
} from './notifications';
import torch from 'torch';
import type { SubscriptionStatus } from './subscription';
import { captureError } from './sentry';
import { track } from './analytics';

// Persist a finished session, retrying once on a transient SQLite failure
// (a momentary lock/contention usually clears on the second try). A finished
// session is the user's achievement, so the completion UI never blocks on the
// write — but a persistent failure is real data loss, so we surface it to
// Sentry instead of swallowing it in a console.error nobody sees in prod.
function saveSessionWithRetry(duration: number): Session | null {
  for (let attempt = 0; attempt < 2; attempt++) {
    try {
      return dbAddSession(duration);
    } catch (e) {
      if (attempt === 0) continue;
      console.error('[store] session save failed after retry:', e);
      captureError(e instanceof Error ? e : new Error(String(e)));
    }
  }
  return null;
}

// Module-level refs (not state, not serializable)
let timerInterval: ReturnType<typeof setInterval> | null = null;
let focusInterval: ReturnType<typeof setInterval> | null = null;
let sessionStartTime = 0;
let focusEndTime = 0;
let sessionNotificationId: string | null = null;
// Subscription transition side-effects run on this chain so two
// concurrent setSubscriptionStatus calls (RC push listener + foreground
// poll) can't interleave their native pause/restore calls. Tracks the
// status whose effects have actually been APPLIED — distinct from the
// `subscriptionStatus` state field, which updates immediately.
let subEffectsChain: Promise<void> = Promise.resolve();
let subEffectsApplied: SubscriptionStatus = 'unknown';

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

// Lapse-episode bookkeeping. `everSubscribed` distinguishes an expired
// subscriber (who gets the "blocks are paused" nudges) from someone who
// never paid (who must not). The episode flags are device-local and
// reset on every return to 'active', so a future lapse nudges again —
// once.
const EVER_SUBSCRIBED_KEY = 'everSubscribed';
const BLOCKS_PAUSED_NOTIFIED_KEY = 'blocksPausedNotified';
export const BLOCKS_PAUSED_PROMO_SHOWN_KEY = 'blocksPausedPromoShown';

// One quiet local notification per lapse episode: a former subscriber
// whose enabled blocks just went dormant learns about it from the
// lock screen instead of discovering it mid-scroll.
async function maybeNotifyBlocksPaused(blocks: ScheduledBlock[]): Promise<void> {
  try {
    if (getDeviceState(EVER_SUBSCRIBED_KEY) !== '1') return;
    if (!blocks.some((b) => b.enabled)) return;
    if (getDeviceState(BLOCKS_PAUSED_NOTIFIED_KEY) === '1') return;
    setDeviceState(BLOCKS_PAUSED_NOTIFIED_KEY, '1');
    const { scheduleBlocksPausedNotification } = await import('./notifications');
    await scheduleBlocksPausedNotification();
  } catch (e) {
    console.error('[store] maybeNotifyBlocksPaused failed:', e);
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
        await scheduleBlock(b.id, b.hour, b.minute, b.durationMinutes, b.weekdays);
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
  /** Set while the session is PAUSED: the frozen elapsed seconds at the
      moment of pause. Cold-start recovery must save exactly this value —
      deriving elapsed from `startedAt` while paused would count the
      whole pause (potentially hours) as session time. Absent while the
      clock is actually ticking. */
  pausedElapsed?: number;
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
    (o.notificationId === null || typeof o.notificationId === 'string') &&
    (o.pausedElapsed === undefined ||
      (typeof o.pausedElapsed === 'number' && Number.isFinite(o.pausedElapsed)))
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

  // Goal
  goalSeconds: number;
  sliderMinutes: number;

  // Focus lock
  focusStep: 'hidden' | 'pickTime' | 'active' | 'done';
  focusRemaining: number;
  focusTotal: number;

  // Settings
  settingsOpen: boolean;
  scheduledBlocks: ScheduledBlock[];

  // Last session metadata (used by SessionCompleteScreen)
  lastSessionId: string;
  lastSessionDuration: number;

  // Session completion (countdown reached 00:00)
  completionVisible: boolean;
  // The countdown finished while the phone lay face down — the celebration
  // waits until the user picks the phone up (revealCompletion), so the
  // success screen is what greets them as they turn it over.
  completionHeld: boolean;
  revealCompletion: () => void;

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

  // First-launch tutorial (spotlight tour over home + settings + journey)
  tutorialCompleted: boolean;
  setTutorialCompleted: () => void;
  // Set true by onboarding finish; consumed by home screen to call
  // copilot's `start()` once on the next mount, then cleared.
  tutorialPending: boolean;
  setTutorialPending: (next: boolean) => void;

  // Completion actions
  completeSession: (opts?: { holdUntilLift?: boolean }) => Promise<void>;
  dismissCompletion: () => void;

  // Milestone actions
  checkMilestones: () => void;

  // Interruption actions
  dismissSessionEnded: () => void;

  // The session lifecycle phase — THE source of truth. All the booleans
  // below it (started/paused/awaitingFaceDown/…) are derived views written
  // atomically by the machine (lib/session-machine.ts); never set them
  // directly.
  phase: SessionPhase;
  // Face-down start ritual: startSession arms the session ("place your
  // phone face down"), beginCountdown actually starts the clock — called by
  // the gate when the accelerometer reports a stable face-down (or via the
  // manual fallback, so nobody can ever get stuck).
  awaitingFaceDown: boolean;
  beginCountdown: () => void;
  /** The single door for surfacing the block-unlock UI. Every surfacer
   *  (cold start, foreground poll, notification, Darwin listener,
   *  session-end) calls this; the decision lives in ONE place.
   *  'busy' = a session/celebration owns the screen, try again later. */
  requestBlockUnlock: (shieldActive: boolean) => 'shown' | 'busy' | 'none';

  // Actions
  init: () => Promise<void>;
  startSession: (opts?: { fromBlock?: boolean }) => void;
  /** The BlockSheet's "do nothing": hide the unlock UI, adopt the block's
   *  unlock goal and arm the face-down ritual — one atomic step. */
  startBlockSession: (unlockMinutes: number) => void;
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

  /**
   * Release the native shield after an earned unlock (completed countdown,
   * "unlock now" from the pause sheet, emergency unlock) AND immediately
   * re-register every enabled block for its next occurrence. The release
   * stops ALL monitors (one-shot or pending), so without the re-register
   * step every other block would silently never fire again until the next
   * cold start — the original "blocks stopped working" bug.
   */
  releaseBlockShield: () => Promise<void>;

  // Settings actions
  openSettings: () => void;
  closeSettings: () => void;
  addScheduledBlock: (hour: number, minute: number, durationMinutes: number, weekdays: number[], unlockGoalMinutes: number) => Promise<void>;
  editScheduledBlock: (id: string, hour: number, minute: number, durationMinutes: number, weekdays: number[], unlockGoalMinutes: number) => Promise<void>;
  removeScheduledBlock: (id: string) => Promise<void>;
  toggleScheduledBlock: (id: string) => Promise<void>;

  // Session actions
  /**
   * Persist a finished session and refresh derived state in one call.
   * Use this for "fire-and-forget" inserts (e.g. onboarding minute) that
   * don't go through the normal stop/complete state machine. Returns the
   * inserted Session or null if the duration is below MIN_SAVABLE_DURATION.
   */
  recordSession: (duration: number) => Session | null;
  deleteSession: (id: string) => Promise<void>;
  deleteSessionsByDate: (dateKey: string) => Promise<void>;
  // Persists the picked mood for a session AND bumps weekStats so
  // ActivityCalendar's session-list memo re-runs and the new mood
  // shows up immediately (otherwise it only appeared after a cold
  // restart).
  updateSessionMood: (id: string, mood: MoodKey) => void;

  // AppState
  handleBackground: () => Promise<void>;
  handleForeground: () => void;

  /**
   * Wipe every piece of locally stored user data — sessions, blocks,
   * settings, milestones, completed-onboarding flag — and reset the
   * in-memory store back to first-launch defaults. Also stops live
   * timers, cancels pending notifications, and releases the native
   * screen-time shield so nothing keeps ticking after the user has
   * asked the app to forget them.
   */
  deleteLocalAccount: () => Promise<void>;
}

// ── Session state machine plumbing ─────────────────────────────────────────
// The ONLY writer of `phase` and its derived legacy flags. Returns false
// (and changes nothing) when the event is illegal in the current phase —
// callers treat that as "stale tap / race, ignore quietly".
type SessionSet = (partial: Partial<AppState>) => void;
function sessionTransition(
  set: SessionSet,
  get: () => AppState,
  event: SessionEvent,
  extra?: Partial<AppState>,
): boolean {
  const next = nextPhase(get().phase, event);
  if (next == null) {
    if (__DEV__) {
      console.warn(`[session-machine] ignored ${event} in phase ${get().phase}`);
    }
    return false;
  }
  set({ phase: next, ...flagsForPhase(next), ...extra });
  // Keep-awake follows the machine, not scattered UI handlers: the screen
  // must not auto-lock from the moment a session is armed until the user
  // is back on the idle home screen.
  try {
    if (event === 'ARM') {
      void activateKeepAwakeAsync('session').catch(() => {});
    } else if (next === 'idle') {
      void deactivateKeepAwake('session').catch(() => {});
    }
  } catch {
    // keep-awake is best-effort (e.g. test envs without the native module)
  }
  return true;
}

export const useAppStore = create<AppState>((set, get) => ({
  // Initial values
  elapsed: 0,
  phase: 'idle',
  started: false,
  awaitingFaceDown: false,
  paused: false,
  sessionOrigin: 'normal',
  weekStats: [],
  ready: false,
  themeMode: 'dark',
  subscriptionStatus: 'unknown',
  isSubscribed: false,
  goalSeconds: 5 * 60,
  sliderMinutes: 5,
  focusStep: 'hidden',
  focusRemaining: 0,
  focusTotal: 0,

  // Last session metadata
  lastSessionId: '',
  lastSessionDuration: 0,

  // Session completion
  completionVisible: false,
  completionHeld: false,

  // Milestones (data only — no overlay UI)
  achievedMilestones: new Map(),

  // Session interruption
  sessionEndedVisible: false,
  cancelReason: null,
  interruptedDuration: null,

  // Settings
  settingsOpen: false,
  scheduledBlocks: [],

  // Onboarding
  onboardingComplete: false,
  setOnboardingComplete: () => {
    setSetting('onboardingComplete', BooleanFlagSchema.parse('1'));
    set({ onboardingComplete: true });
  },

  // Tutorial
  tutorialCompleted: false,
  tutorialPending: false,
  setTutorialCompleted: () => {
    setSetting('tutorialCompleted', BooleanFlagSchema.parse('1'));
    set({ tutorialCompleted: true, tutorialPending: false });
  },
  setTutorialPending: (next) => set({ tutorialPending: next }),

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
    const tutorialCompleted = getSetting('tutorialCompleted') === '1';
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
          await scheduleBlock(b.id, b.hour, b.minute, b.durationMinutes, b.weekdays);
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
      // A session killed while PAUSED recovers its frozen elapsed (the
      // clock wasn't ticking — wall time since start would count the
      // whole pause as session time). A session killed while RUNNING
      // recovers wall time since start: the phone kept lying face down,
      // the real-world session continued without the process.
      const elapsedSec =
        pending.pausedElapsed != null
          ? Math.floor(pending.pausedElapsed)
          : Math.floor((Date.now() - pending.startedAt) / 1000);
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
      onboardingComplete,
      tutorialCompleted,
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

  // --- Session lifecycle ------------------------------------------------
  // Every action below is a thin wrapper around ONE machine transition
  // (lib/session-machine.ts — see the diagram there) plus its side effects
  // (timers, sounds, persistence). The hard invariant: only BEGIN and
  // RESUME create a ticking interval, and both are reached through the
  // face-down ritual or its explicit fallback taps.

  startSession: (opts) => {
    const origin = opts?.fromBlock ? 'block' : 'normal';
    // Arm only — the clock starts in beginCountdown() once the phone is
    // face down. No pending session is persisted yet: an armed-but-never-
    // started session is nothing.
    if (!sessionTransition(set, get, 'ARM', { elapsed: 0, sessionOrigin: origin })) return;
    track('session_armed', { goalSec: get().goalSeconds, origin });
    if (timerInterval) {
      clearInterval(timerInterval);
      timerInterval = null;
    }
  },

  startBlockSession: (unlockMinutes) => {
    set({ focusStep: 'hidden', goalSeconds: unlockMinutes * 60 });
    get().startSession({ fromBlock: true });
  },

  beginCountdown: () => {
    if (!sessionTransition(set, get, 'BEGIN', { elapsed: 0 })) return;
    sessionStartTime = Date.now();
    const goalSeconds = get().goalSeconds;
    track('session_started', { goalSec: goalSeconds, origin: get().sessionOrigin });
    // "It has begun" — felt through the table AND heard (even on silent),
    // so a disabled-vibration setting can't make the start go unnoticed.
    haptics.begin();
    sound.start();
    if (timerInterval) clearInterval(timerInterval);
    timerInterval = setInterval(() => {
      set({ elapsed: Math.floor((Date.now() - sessionStartTime) / 1000) });
    }, 1000);
    trackInterval(timerInterval);
    // No end-of-timer notification — completion is signalled in-app
    // (chime + haptic + torch). Just persist the pending session so a
    // relaunch can recover it.
    sessionNotificationId = null;
    writePendingSession({
      startedAt: sessionStartTime,
      goalSeconds,
      notificationId: null,
    });
  },

  stopSession: async () => {
    const phase = get().phase;
    const event: SessionEvent = phase === 'arming' ? 'CANCEL_ARM' : 'END';
    if (nextPhase(phase, event) == null) return; // nothing to stop
    if (timerInterval) {
      clearInterval(timerInterval);
      timerInterval = null;
    }
    if (sessionNotificationId) {
      try { await cancelNotification(sessionNotificationId); } catch {}
      sessionNotificationId = null;
    }
    clearPendingSession();
    // Backing out of the "place your phone face down" gate — nothing ever
    // ran, so there is nothing to save or celebrate.
    if (event === 'CANCEL_ARM') {
      track('session_arm_cancelled');
      sessionTransition(set, get, 'CANCEL_ARM', {
        elapsed: 0,
        sessionOrigin: 'normal',
        cancelReason: null,
        interruptedDuration: null,
        goalSeconds: get().sliderMinutes * 60,
      });
      return;
    }
    // Use displayed elapsed instead of (Date.now() - sessionStartTime)
    // so paused sessions save the frozen value, not real-time-since-
    // start (which would over-count by the pause duration).
    const duration = get().elapsed;
    track('session_stopped', { durationSec: duration, origin: get().sessionOrigin });
    // A write failure must not leave the UI in a "stopped but still started"
    // zombie state — saveSessionWithRetry returns null and we reset anyway.
    const session = saveSessionWithRetry(duration);
    sessionTransition(set, get, 'END', {
      sessionOrigin: 'normal',
      cancelReason: null,
      interruptedDuration: null,
      weekStats: getWeekStats(),
      lastSessionId: session?.id ?? '',
      lastSessionDuration: duration,
      // Sync the goal back to the slider's visible value — block sessions
      // override goalSeconds and must not leak into the next normal tap.
      goalSeconds: get().sliderMinutes * 60,
    });
    get().checkMilestones();
  },

  pauseSession: () => {
    // PAUSE is only legal from `running` — arming/paused/holding all
    // ignore it (this is what stray taps and background trips hit).
    if (
      !sessionTransition(set, get, 'PAUSE', {
        cancelReason: 'manual',
        interruptedDuration: get().elapsed,
      })
    ) {
      return;
    }
    if (timerInterval) {
      clearInterval(timerInterval);
      timerInterval = null;
    }
    if (sessionNotificationId) {
      cancelNotification(sessionNotificationId).catch(() => {});
      sessionNotificationId = null;
    }
    // Snapshot the frozen elapsed for crash recovery. Without this the
    // pending record still points at the original start time, so an app
    // killed while the pause sheet is up would "recover" the whole pause
    // duration as session time (unbounded in stopwatch mode). Resume
    // rewrites the record without the snapshot; stop/complete clear it.
    writePendingSession({
      startedAt: sessionStartTime,
      goalSeconds: get().goalSeconds,
      notificationId: null,
      pausedElapsed: get().elapsed,
    });
  },

  resumeSession: () => {
    const elapsed = get().elapsed;
    if (
      !sessionTransition(set, get, 'RESUME', {
        cancelReason: null,
        interruptedDuration: null,
      })
    ) {
      return;
    }
    // The same "it has begun" cue as beginCountdown — the clock resuming
    // is a start too, and must never be silent.
    sound.start();
    // Re-anchor sessionStartTime to the frozen elapsed so the next
    // interval tick continues from where we paused.
    sessionStartTime = Date.now() - elapsed * 1000;
    if (timerInterval) clearInterval(timerInterval);
    timerInterval = setInterval(() => {
      set({ elapsed: Math.floor((Date.now() - sessionStartTime) / 1000) });
    }, 1000);
    trackInterval(timerInterval);
    // Persist the pending session for crash/relaunch recovery.
    writePendingSession({
      startedAt: sessionStartTime,
      goalSeconds: get().goalSeconds,
      notificationId: null,
    });
  },

  restartSession: () => {
    if (nextPhase(get().phase, 'START_OVER') == null) return;
    if (sessionNotificationId) {
      cancelNotification(sessionNotificationId).catch(() => {});
      sessionNotificationId = null;
    }
    // Save what they did so far so it is not lost from history (returns
    // null on failure; losing one segment beats blocking a fresh start).
    const prevElapsed = get().elapsed;
    if (prevElapsed > 0) {
      saveSessionWithRetry(prevElapsed);
    }
    if (timerInterval) {
      clearInterval(timerInterval);
      timerInterval = null;
    }
    clearPendingSession();
    // Back through the ritual — the fresh run begins in beginCountdown()
    // once the phone lies face down again.
    track('session_armed', {
      goalSec: get().goalSeconds,
      origin: get().sessionOrigin,
      restart: true,
    });
    sessionTransition(set, get, 'START_OVER', {
      elapsed: 0,
      cancelReason: null,
      interruptedDuration: null,
      weekStats: getWeekStats(),
    });
    // The saved segment counts toward totals — a milestone threshold
    // crossed by it should land now, not on the next unrelated save.
    if (prevElapsed > 0) {
      get().checkMilestones();
    }
  },

  resetElapsed: () => set({ elapsed: 0 }),

  // --- Completion (countdown reached 00:00) ---
  completeSession: async (opts) => {
    // Face down → `holding` (the celebration waits for the lift);
    // in hand → straight to `celebrating`.
    const event: SessionEvent = opts?.holdUntilLift ? 'COMPLETE_HELD' : 'COMPLETE';
    if (nextPhase(get().phase, event) == null) return;
    if (timerInterval) {
      clearInterval(timerInterval);
      timerInterval = null;
    }
    if (sessionNotificationId) {
      try { await cancelNotification(sessionNotificationId); } catch {}
      sessionNotificationId = null;
    }
    clearPendingSession();
    const duration = get().elapsed;
    // Below the threshold this isn't a session — never write a false
    // positive row or surface the celebration.
    if (duration < MIN_SAVABLE_DURATION) {
      sessionTransition(set, get, 'END', {
        elapsed: 0,
        sessionOrigin: 'normal',
        goalSeconds: get().sliderMinutes * 60,
      });
      return;
    }
    const session = saveSessionWithRetry(duration);
    track('session_completed', { durationSec: duration, origin: get().sessionOrigin });
    haptics.success();
    sound.complete();
    // The phone usually lies face down — breathe light up off the table so
    // the end is visible across the room, not just audible.
    void torch.blink();
    sessionTransition(set, get, event, {
      elapsed: 0,
      weekStats: getWeekStats(),
      lastSessionId: session?.id ?? '',
      lastSessionDuration: duration,
      // Sync the goal back to the slider's visible value (see stopSession).
      goalSeconds: get().sliderMinutes * 60,
    });
  },

  revealCompletion: () => {
    sessionTransition(set, get, 'REVEAL');
  },

  dismissCompletion: () => {
    if (!sessionTransition(set, get, 'DISMISS')) return;
    get().checkMilestones();
  },

  /** See AppState.requestBlockUnlock — the one door for the block UI. */
  requestBlockUnlock: (shieldActive) => {
    const s = get();
    if (!s.ready) return 'none';
    // A session or its celebration owns the screen — the shield stays up
    // natively; the unlock UI surfaces when the surface is free again.
    if (!isSessionSurfaceFree(s.phase)) return 'busy';
    if (s.focusStep !== 'hidden') return 'busy';
    if (!shieldActive) return 'none';
    s.showUnlock();
    return 'shown';
  },

  // --- Milestones ---
  checkMilestones: () => {
    const newIds = evaluateAndSaveNewMilestones();
    if (newIds.length > 0) {
      set({ achievedMilestones: getAchievedMilestones() });
    }
  },

  recordSession: (duration: number) => {
    let session: Session | null = null;
    try {
      session = dbAddSession(duration);
    } catch (e) {
      console.error('[store.recordSession] dbAddSession failed:', e);
      return null;
    }
    if (!session) return null;
    set({ weekStats: getWeekStats() });
    get().checkMilestones();
    return session;
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
    if (get().subscriptionStatus !== next) {
      set({ subscriptionStatus: next, isSubscribed: next === 'active' });
    }

    // Side-effects wait for hydration: the RC push listener can fire
    // before init() finishes, and init() reconciles native monitors
    // from DB intent itself — running forceUnblockAll/restore
    // concurrently with that loop leaves monitors nondeterministic.
    // The post-init poll re-calls us with the resolved status, and
    // `subEffectsApplied` (not the state field) decides whether the
    // transition still owes its effects.
    if (!get().ready) return;
    if (subEffectsApplied === next) return;

    // Transition side-effects: keep native DeviceActivity monitors aligned
    // with entitlement state so a lapsed subscription doesn't keep firing
    // shields, and a renewal restores everything the user had. Queued on
    // the chain so transitions apply one at a time, in call order.
    subEffectsChain = subEffectsChain.then(async () => {
      const from = subEffectsApplied;
      if (from === next) return;
      subEffectsApplied = next;
      try {
        if (from === 'active' && next === 'inactive') {
          await pauseAllBlocksForExpiry(get().scheduledBlocks);
          await maybeNotifyBlocksPaused(get().scheduledBlocks);
        } else if (next === 'active') {
          // unknown→active or inactive→active. Either way, native side may
          // have stopped monitors (StoreKit-guard self-cleanup during a
          // lapsed period), so re-register from DB intent.
          // Mark the user as a (once-)subscriber and close any lapse
          // episode so the next expiry nudges exactly once again.
          try {
            setDeviceState(EVER_SUBSCRIBED_KEY, '1');
            deleteDeviceState(BLOCKS_PAUSED_NOTIFIED_KEY);
            deleteDeviceState(BLOCKS_PAUSED_PROMO_SHOWN_KEY);
          } catch (e) {
            console.error('[store.setSubscriptionStatus] episode flags failed:', e);
          }
          await restoreAllBlocksAfterRenewal(get().scheduledBlocks);
        } else if (from === 'unknown' && next === 'inactive') {
          // Defensive cleanup on cold start for non-subscribed users —
          // catches legacy / pre-gating monitors that may still exist.
          try {
            const { forceUnblockAll } = await import('./screen-time');
            await forceUnblockAll();
          } catch (e) {
            console.error('[store.setSubscriptionStatus] forceUnblockAll failed:', e);
          }
          // Cold start after an offline lapse lands here (never
          // active→inactive in-app) — same one-shot nudge applies.
          await maybeNotifyBlocksPaused(get().scheduledBlocks);
        }
      } catch (e) {
        console.error('[store.setSubscriptionStatus] transition failed:', e);
      }
    });
    await subEffectsChain;
  },

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

  releaseBlockShield: async () => {
    try {
      const { forceUnblockAll, scheduleBlock } = await import('./screen-time');
      await forceUnblockAll();
      // scheduleBlock self-gates on auth + subscription, so this is safe
      // to run unconditionally — an inactive user just gets no monitors.
      for (const b of get().scheduledBlocks) {
        if (!b.enabled) continue;
        await scheduleBlock(b.id, b.hour, b.minute, b.durationMinutes, b.weekdays);
      }
    } catch (e) {
      console.error('[store.releaseBlockShield] failed:', e);
    }
  },

  // --- Settings ---
  openSettings: () => set({ settingsOpen: true }),
  closeSettings: () => set({ settingsOpen: false }),

  addScheduledBlock: async (hour, minute, durationMinutes, weekdays, unlockGoalMinutes) => {
    const block = insertScheduledBlock(hour, minute, durationMinutes, weekdays, unlockGoalMinutes);
    track('block_created', { unlockGoalMinutes, durationMinutes, days: weekdays.length });
    try {
      const { scheduleBlock } = await import('./screen-time');
      await scheduleBlock(block.id, hour, minute, durationMinutes, weekdays);
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
      await scheduleBlock(id, hour, minute, durationMinutes, weekdays);
    } catch (e) {
      console.error('[store.editScheduledBlock] native register failed:', e);
      // Rollback DB to the pre-edit values + best-effort restore native.
      if (prev) {
        try {
          dbUpdateScheduledBlock(id, prev.hour, prev.minute, prev.durationMinutes, prev.weekdays, prev.unlockGoalMinutes);
          set({ scheduledBlocks: getAllScheduledBlocks() });
          const { scheduleBlock } = await import('./screen-time');
          await scheduleBlock(id, prev.hour, prev.minute, prev.durationMinutes, prev.weekdays);
        } catch (rollbackErr) {
          console.error('[store.editScheduledBlock] rollback failed:', rollbackErr);
        }
      }
      throw e;
    }
  },

  removeScheduledBlock: async (id) => {
    track('block_removed');
    try {
      const { unscheduleBlock, reconcileBlocks } = await import('./screen-time');
      unscheduleBlock(id);
      // Drop the row first so reconcile sees an accurate "valid IDs" set —
      // otherwise the deleted block's id is still in the DB, reconcile
      // treats its lingering native state as legitimate, and shield-all
      // mode never gets disabled.
      clearNotificationIds('scheduledBlock', id);
      dbDeleteScheduledBlock(id);
      const remaining = getAllScheduledBlocks();
      set({ scheduledBlocks: remaining });
      const validIds = new Set(remaining.filter((b) => b.enabled).map((b) => b.id));
      // Reconcile drops `enableBlockAllMode` + `resetBlocks` when no enabled
      // blocks remain or the shield is stuck active. Without this, deleting
      // the last active block left ManagedSettings shielding everything
      // forever — the user couldn't escape the block by deleting it.
      await reconcileBlocks(validIds);
    } catch (e) {
      console.error('[store.removeScheduledBlock] native unschedule failed:', e);
      clearNotificationIds('scheduledBlock', id);
      dbDeleteScheduledBlock(id);
      set({ scheduledBlocks: getAllScheduledBlocks() });
    }
  },

  toggleScheduledBlock: async (id) => {
    const nowEnabled = dbToggleScheduledBlock(id);
    track('block_toggled', { enabled: nowEnabled });
    const blocks = getAllScheduledBlocks();
    set({ scheduledBlocks: blocks });
    const block = blocks.find(b => b.id === id);
    if (block) {
      try {
        if (nowEnabled) {
          const { scheduleBlock } = await import('./screen-time');
          await scheduleBlock(id, block.hour, block.minute, block.durationMinutes, block.weekdays);
        } else {
          // Toggling off: stop this block's monitor AND reconcile so
          // `enableBlockAllMode` is dropped if no other enabled blocks
          // remain. Without reconcile the shield stays up after the
          // user explicitly disabled the only thing pinning it.
          const { unscheduleBlock, reconcileBlocks } = await import('./screen-time');
          unscheduleBlock(id);
          const validIds = new Set(blocks.filter((b) => b.enabled).map((b) => b.id));
          await reconcileBlocks(validIds);
        }
      } catch (e) {
        console.error('[store.toggleScheduledBlock] native sync failed:', e);
      }
    }
  },

  // --- Interruption handling ---
  // Ancillary cleanup only — the sheet's visibility itself is a derived
  // machine flag (phase === 'paused') and is never written directly.
  dismissSessionEnded: () => {
    try { deleteDeviceState(SESSION_CANCELLED_KEY); } catch {}
    set({
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
    // Re-arm spent one-shot monitors. iOS keeps the process alive for days,
    // so cold-start init alone can't be the only re-registration point — a
    // block that fired yesterday would never fire again. Fire-and-forget;
    // skipped while a shield is up (the post-unlock releaseBlockShield
    // re-registers everything) or a session is live.
    const s = get();
    if (s.ready && !s.started && !s.paused && s.subscriptionStatus !== 'inactive') {
      import('./screen-time')
        .then(({ isBlockActive, rearmDueBlocks }) => {
          if (isBlockActive()) return;
          return rearmDueBlocks(get().scheduledBlocks);
        })
        .catch((e) => console.error('[store.handleForeground] rearm failed:', e));
    }
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

  deleteLocalAccount: async () => {
    // Stop any live timers before tearing down state — leaving them
    // ticking against a wiped DB would dispatch set() calls into a
    // store that no longer reflects them and double-write the next
    // session row from a stale sessionStartTime.
    if (timerInterval) {
      clearInterval(timerInterval);
      timerInterval = null;
    }
    if (focusInterval) {
      clearInterval(focusInterval);
      focusInterval = null;
    }
    sessionStartTime = 0;
    focusEndTime = 0;

    // Cancel the in-flight session-complete notification if a session
    // was running when the user tapped delete. Other scheduled-block
    // notifications get cleared in the bulk cancel below.
    if (sessionNotificationId) {
      try { await cancelNotification(sessionNotificationId); } catch {}
      sessionNotificationId = null;
    }

    // Wipe all scheduled notifications (block alerts, etc.) so the
    // user doesn't get a banner referencing data that no longer exists.
    try {
      const Notifications = await import('expo-notifications');
      await Notifications.cancelAllScheduledNotificationsAsync();
    } catch (e) {
      console.error('[store.deleteLocalAccount] cancel notifications failed:', e);
    }

    // Release the native screen-time shield + drop every DeviceActivity
    // monitor — otherwise apps stay blocked even after the schedules
    // that authorised the block are gone from SQLite.
    try {
      const { unscheduleBlock, forceUnblockAll } = await import('./screen-time');
      for (const b of get().scheduledBlocks) {
        try { unscheduleBlock(b.id); } catch {}
      }
      await forceUnblockAll();
    } catch (e) {
      console.error('[store.deleteLocalAccount] unblock failed:', e);
    }

    clearPendingSession();

    // Drop every row from user-data tables. Schema is preserved so
    // the next write hits ready tables instead of re-running DDL.
    // This one is NOT catch-and-continue: if the wipe throws, the data
    // is still on disk — resetting the UI to first-launch defaults
    // would tell the user "deleted" while SQLite still holds everything
    // (the Privacy Policy promises deletion). Rethrow and let the
    // caller surface the failure instead.
    try {
      wipeUserData();
    } catch (e) {
      console.error('[store.deleteLocalAccount] wipeUserData failed:', e);
      throw e;
    }

    // Reset Zustand back to first-launch defaults. Mirrors the
    // initial values declared at the top of create() — keep the two
    // in sync if you add new state fields.
    set({
      elapsed: 0,
      phase: 'idle',
      ...flagsForPhase('idle'),
      sessionOrigin: 'normal',
      weekStats: [],
      themeMode: 'dark',
      goalSeconds: 5 * 60,
      sliderMinutes: 5,
      focusStep: 'hidden',
      focusRemaining: 0,
      focusTotal: 0,
      lastSessionId: '',
      lastSessionDuration: 0,
      completionVisible: false,
      achievedMilestones: new Map(),
      sessionEndedVisible: false,
      cancelReason: null,
      interruptedDuration: null,
      settingsOpen: false,
      scheduledBlocks: [],
      onboardingComplete: false,
      tutorialCompleted: false,
      tutorialPending: false,
    });
  },
}));
