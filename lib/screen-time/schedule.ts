import {
  configureActions,
  disableBlockAllMode,
  getActivities,
  resetBlocks,
  startMonitoring,
  stopMonitoring,
  unblockSelection,
  updateShield,
} from 'react-native-device-activity';

import type { DeviceActivityAction } from './actions';
import type { ScheduledBlock } from '../db/types';
import { useAppStore } from '../store';
import { getAuth } from './auth';
import {
  NEVER_BLOCK_SELECTION_ID,
  SHIELD_ACTIONS,
  SHIELD_CONFIG,
  isBlockActive,
} from './shield';

const ALL_WEEKDAYS: readonly number[] = [1, 2, 3, 4, 5, 6, 7];

/**
 * Apple's `DeviceActivityCenter` accepts at most ~20 simultaneously
 * monitored activities per app. We register one monitor per enabled
 * scheduled block, so cap user-created blocks well below that ceiling
 * to leave headroom for any internal/legacy names that might still be
 * lingering in native state.
 */
export const MAX_BLOCKS = 15;

/**
 * Compute the next moment (at least `leadMs` from now) when a block should fire.
 *
 * @param weekdays iOS convention 1=Sun..7=Sat, or empty/all-7 for daily
 * @returns Date in the future, or null if no day in the next week matches
 *
 * The default 30-second lead exists so we never schedule for a moment that's
 * effectively "now" — Apple needs `intervalStart` strictly in the future.
 */
function nextFireDate(
  hour: number,
  minute: number,
  weekdays: number[],
  leadMs = 30 * 1000,
): Date | null {
  const now = new Date();
  const today = new Date(
    now.getFullYear(),
    now.getMonth(),
    now.getDate(),
    hour,
    minute,
    0,
    0,
  );
  for (let offset = 0; offset < 7; offset++) {
    const candidate = new Date(today.getTime() + offset * 24 * 60 * 60 * 1000);
    if (candidate.getTime() <= now.getTime() + leadMs) continue;
    const candWeekday = candidate.getDay() + 1;
    if (weekdays.length === 0 || weekdays.includes(candWeekday)) {
      return candidate;
    }
  }
  return null;
}

/**
 * Block-all mode + whitelist of the user-defined "never block" selection;
 * the shield raises for every app outside that whitelist. Plus a
 * notification with `block_start.caf` and timeSensitive level so the user
 * actually hears it (Apple's intervalDidStart action chain runs from the
 * ActivityMonitorExtension, which our patched Shared.swift routes through
 * `UNNotificationSound(named:)` for non-system sound names).
 */
function buildStartActions(): DeviceActivityAction[] {
  return [
    { type: 'clearWhitelist' },
    { type: 'enableBlockAllMode' },
    {
      type: 'addSelectionToWhitelist',
      familyActivitySelection: { activitySelectionId: NEVER_BLOCK_SELECTION_ID },
    },
    {
      type: 'sendNotification',
      payload: {
        title: 'Nothing',
        body: 'Time to do nothing.',
        sound: 'block_start.caf',
        interruptionLevel: 'timeSensitive',
      },
    },
  ];
}

export async function scheduleBlock(
  blockId: string,
  hour: number,
  minute: number,
  // Block window length in user-facing minutes. Currently informational —
  // the native interval is a fixed 16-min window starting at firstFire (>=
  // iOS 15-min minimum); the shield stays up until JS-side `forceUnblockAll`
  // or another reconcile pass disables it.
  _durationMinutes: number,
  weekdays: number[],
): Promise<void> {
  // Don't surprise the user with a system Screen Time prompt during init or
  // bulk re-scheduling — the Settings UI is responsible for an explicit
  // approval tap before the first block is created.
  const auth = await getAuth();
  if (auth !== 'approved') {
    if (__DEV__) console.log('[ScreenTime] scheduleBlock skipped — auth status:', auth);
    return;
  }

  // Subscription gate: a known-inactive user gets no native monitor at all —
  // blocks are a paid feature, and the DB row (user intent) is restored by
  // `restoreAllBlocksAfterRenewal` on the inactive→active transition.
  // 'unknown' (RC not yet resolved / offline) schedules optimistically: the
  // extension's own gate reads the mirrored RC status at fire time, so a
  // truly-lapsed user is still refused there.
  if (useAppStore.getState().subscriptionStatus === 'inactive') {
    if (__DEV__) console.log('[ScreenTime] scheduleBlock skipped — subscription inactive');
    return;
  }

  const startActions = buildStartActions();
  await updateShield(SHIELD_CONFIG, SHIELD_ACTIONS);

  // One-shot non-repeating monitor with full year/month/day/hour/minute.
  // iOS silently drops `repeats:true` schedules whose hour/minute matches
  // an already-elapsed time today — meaning a freshly-registered "9 PM
  // every day" block would silently wait until tomorrow. With a fully-
  // qualified date and `repeats: false`, iOS fires reliably at exactly
  // that moment. Cold-start init re-registers the next occurrence each
  // time the user opens the app.
  const firstFire = nextFireDate(hour, minute, weekdays);
  if (!firstFire) {
    console.warn('[ScreenTime] No upcoming fire for block', blockId);
    return;
  }
  const fireEnd = new Date(firstFire.getTime() + 16 * 60 * 1000);
  const name = `block-${blockId}`;
  configureActions({
    activityName: name,
    callbackName: 'intervalDidStart',
    actions: startActions as unknown as Parameters<typeof configureActions>[0]['actions'],
  });
  await startMonitoring(
    name,
    {
      intervalStart: {
        year: firstFire.getFullYear(),
        month: firstFire.getMonth() + 1, // iOS expects 1-12
        day: firstFire.getDate(),
        hour: firstFire.getHours(),
        minute: firstFire.getMinutes(),
        second: 0,
      },
      intervalEnd: {
        year: fireEnd.getFullYear(),
        month: fireEnd.getMonth() + 1,
        day: fireEnd.getDate(),
        hour: fireEnd.getHours(),
        minute: fireEnd.getMinutes(),
        second: 0,
      },
      repeats: false,
    },
    [],
  );

  if (__DEV__) {
    console.log(
      `[ScreenTime] Scheduled block ${blockId} for ${firstFire.toISOString()}`,
    );
  }
}

export function unscheduleBlock(blockId: string): void {
  // Cover every name shape we may have registered across upgrades:
  //   block-{id}        — current (and legacy single-monitor)
  //   block-{id}-1..7   — legacy per-weekday monitors
  //   block-{id}-once   — legacy one-shot shadow used briefly during the
  //                       recurring+shadow approach
  const names = ALL_WEEKDAYS.map((w) => `block-${blockId}-${w}`);
  names.push(`block-${blockId}`);
  names.push(`block-${blockId}-once`);
  stopMonitoring(names);
}

/**
 * Re-register every enabled block for its next occurrence. Monitors are
 * one-shot (`repeats: false`), so a block that has fired stays dead until
 * something re-registers it — this runs on every foreground (and after the
 * post-unlock reset) so a spent block is always re-armed the next time the
 * user is in the app, not only on a cold start.
 *
 * Re-registering an untouched pending monitor is harmless — it lands on the
 * same occurrence. The one exception: inside the last 90 seconds before a
 * block's moment, re-registering would push it to the NEXT occurrence
 * (scheduleBlock needs a 30s lead), so an imminent block is left alone.
 */
export async function rearmDueBlocks(blocks: ScheduledBlock[]): Promise<void> {
  for (const b of blocks) {
    if (!b.enabled) continue;
    const fire = nextFireDate(b.hour, b.minute, b.weekdays, 0);
    if (fire && fire.getTime() - Date.now() < 90 * 1000) continue;
    try {
      unscheduleBlock(b.id);
      await scheduleBlock(b.id, b.hour, b.minute, b.durationMinutes, b.weekdays);
    } catch (e) {
      console.error('[ScreenTime] rearm failed for block', b.id, e);
    }
  }
}

/** @internal Used only by dev diagnostics. */
export function getActiveMonitors(): string[] {
  return getActivities();
}

/**
 * Full nuclear reset — stops every monitor, drops block-all mode, and
 * resets the native block list. Use when the DB has no blocks but the
 * native shield is still active.
 */
export async function forceUnblockAll(): Promise<void> {
  try { stopMonitoring(); } catch {}
  try { disableBlockAllMode(); } catch {}
  try { resetBlocks(); } catch {}
  try {
    await unblockSelection({ activitySelectionId: NEVER_BLOCK_SELECTION_ID });
  } catch {}
}

/**
 * Stop any `block-*` native monitors whose id is not in `validBlockIds`,
 * and release shield state if we cleaned anything up. Fixes the case where
 * the DB has been wiped but the native schedule/shield is still active.
 */
export async function reconcileBlocks(
  validBlockIds: Set<string>,
): Promise<void> {
  try {
    const active = getActivities();
    const prefix = 'block-';
    const ours = active.filter((n) => n.startsWith(prefix));
    // Monitor names are either `block-{id}` (legacy) or `block-{id}-{weekday}`
    // (post-weekday-filter upgrade). IDs are UUIDs and contain hyphens, so we
    // match by startsWith rather than splitting on '-'.
    const orphans = ours.filter((n) => {
      const rest = n.slice(prefix.length);
      for (const id of validBlockIds) {
        if (rest === id || rest.startsWith(`${id}-`)) return false;
      }
      return true;
    });

    const dbEmpty = validBlockIds.size === 0;
    const shieldStuck = isBlockActive() && validBlockIds.size === 0;

    if (dbEmpty || shieldStuck) {
      if (__DEV__) console.log('[ScreenTime] Full reset (dbEmpty=%s, stuck=%s)', dbEmpty, shieldStuck);
      await forceUnblockAll();
      return;
    }

    if (orphans.length > 0) {
      if (__DEV__) console.log('[ScreenTime] Stopping orphan monitors:', orphans);
      stopMonitoring(orphans);
      try { disableBlockAllMode(); } catch {}
    }
  } catch (e) {
    console.warn('[ScreenTime] reconcile failed:', e);
  }
}
