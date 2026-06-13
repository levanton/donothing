/**
 * useAppStore is a large Zustand store. This file targets the pure
 * surface: initial state, simple setters, DB-backed actions, and the
 * subscription transition side-effects. The timer state machine
 * (start/stop/pause/resume) is intentionally not covered — its
 * setInterval-driven progression is better exercised end-to-end.
 */

jest.mock('@/lib/screen-time', () => ({
  forceUnblockAll: jest.fn().mockResolvedValue(undefined),
  reconcileBlocks: jest.fn().mockResolvedValue(undefined),
  scheduleBlock: jest.fn().mockResolvedValue(undefined),
  unscheduleBlock: jest.fn(),
  isBlockActive: jest.fn(() => false),
  copyShieldIcon: jest.fn().mockResolvedValue(undefined),
}));

jest.mock('@/lib/notifications', () => ({
  configureNotifications: jest.fn(),
  scheduleSessionCompleteNotification: jest.fn().mockResolvedValue('notif-id'),
  scheduleBlocksPausedNotification: jest.fn().mockResolvedValue('notif-id'),
  cancelNotification: jest.fn().mockResolvedValue(undefined),
}));

// expo-audio has a TurboModule binding that fails to load in node.
// Replace the lib/sound wrapper instead.
jest.mock('@/lib/sound', () => ({
  sound: { complete: jest.fn(), start: jest.fn() },
}));

// expo-haptics also binds natively — the recovery tests drive the real
// start/pause/resume actions, which fire haptic cues.
jest.mock('@/lib/haptics', () => ({
  haptics: {
    light: jest.fn(),
    medium: jest.fn(),
    success: jest.fn(),
    error: jest.fn(),
    select: jest.fn(),
    begin: jest.fn(),
    celebrate: jest.fn(),
  },
}));

import { resetDbState } from '../db/helpers';

type StoreModule = typeof import('@/lib/store');
type SettingsModule = typeof import('@/lib/db/settings');
type SessionsModule = typeof import('@/lib/db/sessions');

interface StoreBundle {
  store: StoreModule;
  settings: SettingsModule;
  sessions: SessionsModule;
}

// Load store + DB modules from the same isolateModules call so they
// share the SQLite singleton from lib/db/index.ts.
function loadStore(): StoreBundle {
  let store: StoreModule;
  let settings: SettingsModule;
  let sessions: SessionsModule;
  jest.isolateModules(() => {
    store = require('@/lib/store');
    settings = require('@/lib/db/settings');
    sessions = require('@/lib/db/sessions');
  });
  return { store: store!, settings: settings!, sessions: sessions! };
}

afterEach(() => {
  resetDbState();
  jest.restoreAllMocks();
  // The screen-time/notifications mock instances are shared across the
  // whole file (module registry), so call history leaks between tests
  // without an explicit clear.
  jest.clearAllMocks();
});

describe('initial state', () => {
  it('mounts with sensible defaults', () => {
    const { store } = loadStore();
    const state = store.useAppStore.getState();
    expect(state.elapsed).toBe(0);
    expect(state.started).toBe(false);
    expect(state.paused).toBe(false);
    expect(state.ready).toBe(false);
    expect(state.subscriptionStatus).toBe('unknown');
    expect(state.isSubscribed).toBe(false);
    expect(state.goalSeconds).toBe(5 * 60);
    expect(state.sliderMinutes).toBe(5);
    expect(state.focusStep).toBe('hidden');
    expect(state.themeMode).toBe('dark');
    expect(state.onboardingComplete).toBe(false);
    expect(state.tutorialCompleted).toBe(false);
    expect(state.tutorialPending).toBe(false);
  });
});

describe('simple setters', () => {
  it('setSliderMinutes / setGoalFromSlider update the goal', () => {
    const { store } = loadStore();
    store.useAppStore.getState().setSliderMinutes(12);
    expect(store.useAppStore.getState().sliderMinutes).toBe(12);

    store.useAppStore.getState().setGoalFromSlider(10);
    expect(store.useAppStore.getState().goalSeconds).toBe(600);
  });

  it('openSettings / closeSettings toggle the flag', () => {
    const { store } = loadStore();
    store.useAppStore.getState().openSettings();
    expect(store.useAppStore.getState().settingsOpen).toBe(true);
    store.useAppStore.getState().closeSettings();
    expect(store.useAppStore.getState().settingsOpen).toBe(false);
  });

  it('setTutorialPending flips the bool', () => {
    const { store } = loadStore();
    store.useAppStore.getState().setTutorialPending(true);
    expect(store.useAppStore.getState().tutorialPending).toBe(true);
    store.useAppStore.getState().setTutorialPending(false);
    expect(store.useAppStore.getState().tutorialPending).toBe(false);
  });

  it('openFocusPicker sets focusStep to pickTime', () => {
    const { store } = loadStore();
    store.useAppStore.getState().openFocusPicker();
    expect(store.useAppStore.getState().focusStep).toBe('pickTime');
  });

  it('resetElapsed zeroes the timer', () => {
    const { store } = loadStore();
    store.useAppStore.setState({ elapsed: 42 });
    store.useAppStore.getState().resetElapsed();
    expect(store.useAppStore.getState().elapsed).toBe(0);
  });
});

describe('toggleTheme', () => {
  it('flips between dark and light and persists to device_state', () => {
    const { store, settings } = loadStore();
    expect(store.useAppStore.getState().themeMode).toBe('dark');
    store.useAppStore.getState().toggleTheme();
    expect(store.useAppStore.getState().themeMode).toBe('light');
    expect(settings.getDeviceState('theme')).toBe('light');
    store.useAppStore.getState().toggleTheme();
    expect(store.useAppStore.getState().themeMode).toBe('dark');
    expect(settings.getDeviceState('theme')).toBe('dark');
  });
});

describe('setOnboardingComplete', () => {
  it('flips the flag and persists "1" to settings', () => {
    const { store, settings } = loadStore();
    store.useAppStore.getState().setOnboardingComplete();
    expect(store.useAppStore.getState().onboardingComplete).toBe(true);
    expect(settings.getSetting('onboardingComplete')).toBe('1');
  });
});

describe('setTutorialCompleted', () => {
  it('flips both completed/pending flags and persists', () => {
    const { store, settings } = loadStore();
    store.useAppStore.getState().setTutorialPending(true);
    store.useAppStore.getState().setTutorialCompleted();
    const state = store.useAppStore.getState();
    expect(state.tutorialCompleted).toBe(true);
    expect(state.tutorialPending).toBe(false);
    expect(settings.getSetting('tutorialCompleted')).toBe('1');
  });
});

describe('recordSession', () => {
  it('returns the inserted session and refreshes weekStats', () => {
    const { store } = loadStore();
    const session = store.useAppStore.getState().recordSession(120);
    expect(session).not.toBeNull();
    expect(session!.duration).toBe(120);
    expect(store.useAppStore.getState().weekStats.length).toBe(7);
  });

  it('returns null when the DB rejects (sub-minute duration)', () => {
    jest.spyOn(console, 'warn').mockImplementation(() => {});
    const { store } = loadStore();
    const session = store.useAppStore.getState().recordSession(30);
    expect(session).toBeNull();
  });
});

describe('deleteSession', () => {
  it('removes a row from the DB', async () => {
    const { store, sessions } = loadStore();
    const s = store.useAppStore.getState().recordSession(120)!;
    await store.useAppStore.getState().deleteSession(s.id);
    expect(sessions.getSessionCount()).toBe(0);
  });
});

describe('cold-start pending-session recovery', () => {
  // Writes the pending record exactly the way a previous (killed) app
  // process would have left it, then runs init() and inspects what
  // landed in the sessions table.
  const writePending = (settings: SettingsModule, p: object) => {
    settings.setDeviceState('session_pending', JSON.stringify(p));
  };

  it('killed while RUNNING → recovers wall-clock elapsed since start', async () => {
    const { store, settings, sessions } = loadStore();
    writePending(settings, {
      startedAt: Date.now() - 90_000,
      goalSeconds: 300,
      notificationId: null,
    });
    await store.useAppStore.getState().init();
    const saved = sessions.getAllSessions();
    expect(saved).toHaveLength(1);
    expect(saved[0].duration).toBeGreaterThanOrEqual(89);
    expect(saved[0].duration).toBeLessThanOrEqual(92);
  });

  it('killed while PAUSED → recovers the frozen elapsed, not the pause time', async () => {
    const { store, settings, sessions } = loadStore();
    // Stopwatch session (goal=0): paused at 75s, app killed, relaunched
    // 3 hours later. The old bug recovered ~3h as session time.
    writePending(settings, {
      startedAt: Date.now() - 3 * 3600 * 1000,
      goalSeconds: 0,
      notificationId: null,
      pausedElapsed: 75,
    });
    await store.useAppStore.getState().init();
    const saved = sessions.getAllSessions();
    expect(saved).toHaveLength(1);
    expect(saved[0].duration).toBe(75);
  });

  it('killed while PAUSED with a goal → frozen elapsed also wins over wall time', async () => {
    const { store, settings, sessions } = loadStore();
    writePending(settings, {
      startedAt: Date.now() - 10 * 60 * 1000,
      goalSeconds: 300,
      notificationId: null,
      pausedElapsed: 130,
    });
    await store.useAppStore.getState().init();
    const saved = sessions.getAllSessions();
    expect(saved).toHaveLength(1);
    expect(saved[0].duration).toBe(130);
  });

  it('pauseSession snapshots the frozen elapsed; resumeSession clears it', () => {
    const { store, settings } = loadStore();
    const s = store.useAppStore.getState();
    s.startSession();
    s.beginCountdown();
    store.useAppStore.setState({ elapsed: 45 });
    s.pauseSession();
    const paused = JSON.parse(settings.getDeviceState('session_pending')!);
    expect(paused.pausedElapsed).toBe(45);

    store.useAppStore.getState().resumeSession();
    const resumed = JSON.parse(settings.getDeviceState('session_pending')!);
    expect(resumed.pausedElapsed).toBeUndefined();

    // Resume restarted the ticking interval — pause again so the test
    // doesn't leak a live timer into the rest of the suite.
    store.useAppStore.getState().pauseSession();
  });
});

describe('completeSession from the pause sheet (stopwatch finish)', () => {
  it('completes a paused stopwatch run: saves the frozen elapsed and celebrates', async () => {
    const { store, sessions } = loadStore();
    const s = store.useAppStore.getState();
    s.setGoalFromSlider(0); // stopwatch mode (no countdown)
    s.startSession();
    s.beginCountdown();
    store.useAppStore.setState({ elapsed: 180 });
    store.useAppStore.getState().pauseSession();
    expect(store.useAppStore.getState().phase).toBe('paused');

    await store.useAppStore.getState().completeSession();
    const after = store.useAppStore.getState();
    expect(after.phase).toBe('celebrating');
    const saved = sessions.getAllSessions();
    expect(saved).toHaveLength(1);
    expect(saved[0].duration).toBe(180);
  });
});

describe('handleBackground', () => {
  it('cancels an ARMED session (face-down gate) instead of hanging in arming', async () => {
    const { store } = loadStore();
    const s = store.useAppStore.getState();
    s.startSession();
    expect(store.useAppStore.getState().phase).toBe('arming');

    await store.useAppStore.getState().handleBackground();
    const after = store.useAppStore.getState();
    expect(after.phase).toBe('idle');
    expect(after.started).toBe(false);
  });

  it('pauses a RUNNING session', async () => {
    const { store } = loadStore();
    const s = store.useAppStore.getState();
    s.startSession();
    s.beginCountdown();

    await store.useAppStore.getState().handleBackground();
    const after = store.useAppStore.getState();
    expect(after.phase).toBe('paused');
    expect(after.paused).toBe(true);
  });
});

describe('releaseBlockShield', () => {
  // The day-boundary safety hinges on this action: monitors are one-shot,
  // and while a shield is up the foreground re-arm is intentionally
  // skipped — so EVERY path that drops the shield must re-register all
  // enabled blocks for their next occurrence, or a block that fired
  // yesterday would never fire again.
  it('drops the shield and re-arms every enabled block', async () => {
    const { store } = loadStore();
    const { forceUnblockAll, scheduleBlock } = require('@/lib/screen-time');
    store.useAppStore.setState({
      scheduledBlocks: [
        { id: 'b1', hour: 21, minute: 0, durationMinutes: 30, weekdays: [], enabled: true, unlockGoalMinutes: 5 },
        { id: 'b2', hour: 10, minute: 0, durationMinutes: 30, weekdays: [1], enabled: false, unlockGoalMinutes: 5 },
      ],
    });
    await store.useAppStore.getState().releaseBlockShield();
    expect(forceUnblockAll).toHaveBeenCalled();
    expect(scheduleBlock).toHaveBeenCalledTimes(1);
    expect(scheduleBlock).toHaveBeenCalledWith('b1', 21, 0, 30, []);
  });
});

describe('setSubscriptionStatus', () => {
  // Side-effects are gated on `ready` (init() reconciles native monitors
  // itself; effects running concurrently with that loop are a race), so
  // every test that expects effects must hydrate the flag first.

  it('is a no-op when status does not change', async () => {
    const { store } = loadStore();
    const { forceUnblockAll } = require('@/lib/screen-time');
    store.useAppStore.setState({ ready: true });
    await store.useAppStore.getState().setSubscriptionStatus('unknown');
    expect(forceUnblockAll).not.toHaveBeenCalled();
  });

  it('on active → inactive it pauses every enabled block', async () => {
    const { store } = loadStore();
    const { unscheduleBlock, forceUnblockAll } = require('@/lib/screen-time');
    store.useAppStore.setState({
      ready: true,
      scheduledBlocks: [
        { id: 'b1', hour: 9, minute: 0, durationMinutes: 30, weekdays: [1], enabled: true, unlockGoalMinutes: 5 },
        { id: 'b2', hour: 10, minute: 0, durationMinutes: 30, weekdays: [1], enabled: false, unlockGoalMinutes: 5 },
      ],
    });
    // Walk the applied-effects tracker to 'active' through the real API
    // (it's module-internal, deliberately not reachable via setState).
    await store.useAppStore.getState().setSubscriptionStatus('active');
    await store.useAppStore.getState().setSubscriptionStatus('inactive');
    expect(unscheduleBlock).toHaveBeenCalledWith('b1');
    expect(unscheduleBlock).not.toHaveBeenCalledWith('b2');
    expect(forceUnblockAll).toHaveBeenCalled();
    expect(store.useAppStore.getState().subscriptionStatus).toBe('inactive');
    expect(store.useAppStore.getState().isSubscribed).toBe(false);
  });

  it('demotes a running block session to normal when the shield is dropped', async () => {
    const { store } = loadStore();
    store.useAppStore.setState({
      ready: true,
      started: true,
      sessionOrigin: 'block',
      scheduledBlocks: [
        { id: 'b1', hour: 9, minute: 0, durationMinutes: 30, weekdays: [1], enabled: true, unlockGoalMinutes: 5 },
      ],
    });
    await store.useAppStore.getState().setSubscriptionStatus('active');
    await store.useAppStore.getState().setSubscriptionStatus('inactive');
    // The shield is gone, so the run is no longer a block session — the
    // pause sheet / completion screen must stop offering unlock actions.
    expect(store.useAppStore.getState().sessionOrigin).toBe('normal');
  });

  it('leaves a normal running session untouched on expiry', async () => {
    const { store } = loadStore();
    store.useAppStore.setState({
      ready: true,
      started: true,
      sessionOrigin: 'normal',
      scheduledBlocks: [],
    });
    await store.useAppStore.getState().setSubscriptionStatus('active');
    await store.useAppStore.getState().setSubscriptionStatus('inactive');
    expect(store.useAppStore.getState().sessionOrigin).toBe('normal');
  });

  it('on inactive → active it restores via reconcile + reschedule', async () => {
    const { store } = loadStore();
    const { reconcileBlocks, scheduleBlock } = require('@/lib/screen-time');
    store.useAppStore.setState({
      ready: true,
      scheduledBlocks: [
        { id: 'b1', hour: 9, minute: 0, durationMinutes: 30, weekdays: [1], enabled: true, unlockGoalMinutes: 5 },
      ],
    });
    await store.useAppStore.getState().setSubscriptionStatus('inactive');
    await store.useAppStore.getState().setSubscriptionStatus('active');
    expect(reconcileBlocks).toHaveBeenCalled();
    expect(scheduleBlock).toHaveBeenCalledWith('b1', 9, 0, 30, [1]);
    expect(store.useAppStore.getState().isSubscribed).toBe(true);
  });

  it('on unknown → inactive it sweeps stale monitors', async () => {
    const { store } = loadStore();
    const { forceUnblockAll } = require('@/lib/screen-time');
    store.useAppStore.setState({ ready: true });
    await store.useAppStore.getState().setSubscriptionStatus('inactive');
    expect(forceUnblockAll).toHaveBeenCalled();
  });

  it('defers side-effects until ready, then applies them on the next call', async () => {
    const { store } = loadStore();
    const { forceUnblockAll } = require('@/lib/screen-time');
    // RC push listener fires before init() finished: status updates,
    // but no native calls happen while init's reconcile may be running.
    await store.useAppStore.getState().setSubscriptionStatus('inactive');
    expect(store.useAppStore.getState().subscriptionStatus).toBe('inactive');
    expect(forceUnblockAll).not.toHaveBeenCalled();
    // Post-init poll re-resolves the same status — the owed unknown→inactive
    // effects must run now even though the state field didn't change.
    store.useAppStore.setState({ ready: true });
    await store.useAppStore.getState().setSubscriptionStatus('inactive');
    expect(forceUnblockAll).toHaveBeenCalled();
  });

  it('serializes concurrent transitions in call order', async () => {
    const { store } = loadStore();
    const { forceUnblockAll, reconcileBlocks } = require('@/lib/screen-time');
    store.useAppStore.setState({ ready: true });
    // Fire both without awaiting — listener + foreground poll racing.
    const p1 = store.useAppStore.getState().setSubscriptionStatus('inactive');
    const p2 = store.useAppStore.getState().setSubscriptionStatus('active');
    await Promise.all([p1, p2]);
    // unknown→inactive sweep ran fully before inactive→active restore.
    const sweepOrder = (forceUnblockAll as jest.Mock).mock.invocationCallOrder[0];
    const restoreOrder = (reconcileBlocks as jest.Mock).mock.invocationCallOrder[0];
    expect(sweepOrder).toBeLessThan(restoreOrder);
    expect(store.useAppStore.getState().subscriptionStatus).toBe('active');
  });
});
