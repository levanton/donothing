import {
  requestAuthorization,
  getAuthorizationStatus,
  blockSelection,
  unblockSelection,
  isAvailable,
  updateShield,
  startMonitoring,
  stopMonitoring,
  configureActions,
  getActivities,
  isShieldActive,
  getAppGroupFileDirectory,
  copyFile,
  disableBlockAllMode,
  resetBlocks,
  onDeviceActivityMonitorEvent,
  type ShieldActions,
} from 'react-native-device-activity';
import { Asset } from 'expo-asset';

// Fires whenever the native DeviceActivity extension starts a scheduled
// interval — i.e. the moment the shield goes up. Delivered via a Darwin
// notification, so it's reliable in foreground where
// Notifications.addNotificationReceivedListener can be silently dropped.
export function onBlockShieldRaised(listener: () => void) {
  return onDeviceActivityMonitorEvent((event) => {
    if (event.callbackName === 'intervalDidStart') listener();
  });
}

export type AuthStatus = 'notDetermined' | 'denied' | 'approved';

const AUTH_MAP: Record<number, AuthStatus> = {
  0: 'notDetermined',
  1: 'denied',
  2: 'approved',
};

export async function checkAvailable(): Promise<boolean> {
  try {
    return isAvailable();
  } catch {
    return false;
  }
}

export async function getAuth(): Promise<AuthStatus> {
  try {
    const status = await getAuthorizationStatus();
    return AUTH_MAP[status] ?? 'notDetermined';
  } catch {
    return 'notDetermined';
  }
}

export async function requestAuth(): Promise<AuthStatus> {
  try {
    // Only show the system prompt if the user hasn't decided yet. Calling
    // requestAuthorization repeatedly when status is already approved/denied
    // can re-trigger the iOS Screen Time prompt on every render.
    const current = await getAuth();
    if (current !== 'notDetermined') return current;
    await requestAuthorization('individual');
    return getAuth();
  } catch {
    return 'denied';
  }
}

export async function blockApps(selectionToken: string): Promise<void> {
  await blockSelection({ activitySelectionToken: selectionToken });
  await updateShield(SHIELD_CONFIG, SHIELD_ACTIONS);
}

export async function unblockApps(selectionToken: string): Promise<void> {
  await unblockSelection({ activitySelectionToken: selectionToken });
}

export async function blockAppsById(selectionId: string): Promise<void> {
  await blockSelection({ activitySelectionId: selectionId });
  await updateShield(SHIELD_CONFIG, SHIELD_ACTIONS);
}

export async function unblockAppsById(selectionId: string): Promise<void> {
  await unblockSelection({ activitySelectionId: selectionId });
}

const SHIELD_ICON_FILENAME = 'shield-icon.png';

export async function copyShieldIcon(): Promise<void> {
  try {
    const [asset] = await Asset.loadAsync(require('@/assets/Icon.icon/Assets/enso_D8522E_transparent.png'));
    const appGroupDir = getAppGroupFileDirectory();
    if (asset.localUri && appGroupDir) {
      copyFile(asset.localUri, `${appGroupDir}/${SHIELD_ICON_FILENAME}`, true);
    }
  } catch (e) {
    console.warn('Failed to copy shield icon:', e);
  }
}

// Colors in 0-255 range (native getColor divides by 255)
const SHIELD_CONFIG = {
  title: 'Do Nothing',
  titleColor: { red: 43, green: 37, blue: 34, alpha: 1.0 },
  subtitle: 'time to do nothing.',
  subtitleColor: { red: 43, green: 37, blue: 34, alpha: 0.55 },
  backgroundColor: { red: 249, green: 243, blue: 224, alpha: 1.0 },
  primaryButtonLabel: 'Open Do Nothing',
  primaryButtonLabelColor: { red: 255, green: 255, blue: 255, alpha: 1.0 },
  primaryButtonBackgroundColor: { red: 199, green: 91, blue: 58, alpha: 1.0 },
  secondaryButtonLabel: 'Close',
  secondaryButtonLabelColor: { red: 43, green: 37, blue: 34, alpha: 0.4 },
  iconAppGroupRelativePath: SHIELD_ICON_FILENAME,
};

const SHIELD_ACTIONS: ShieldActions = {
  primary: {
    behavior: 'close',
    actions: [
      { type: 'openApp' },
      {
        type: 'sendNotification',
        payload: {
          title: 'Do Nothing',
          body: 'Tap to open Do Nothing',
          sound: 'default',
          // The package's .d.ts is missing 'timeSensitive', but it's a
          // real iOS UNNotificationInterruptionLevel value and breaks
          // through Focus mode — what we want for scheduled-block alerts.
          interruptionLevel: 'timeSensitive' as 'active',
        },
      },
    ],
  },
  secondary: { behavior: 'close' },
};

export const NEVER_BLOCK_SELECTION_ID = 'nothing-never-block';

const ALL_WEEKDAYS: readonly number[] = [1, 2, 3, 4, 5, 6, 7];

function blockActivityName(blockId: string, weekday: number): string {
  return `block-${blockId}-${weekday}`;
}

export async function scheduleBlock(
  blockId: string,
  hour: number,
  minute: number,
  durationMinutes: number,
  weekdays: number[],
  // Reserved for future native shield-side enforcement; today only JS gates on it.
  _unlockGoalMinutes?: number,
): Promise<void> {
  // Ensure authorization — but never trigger the system prompt here. Init
  // and re-scheduling can call this for many blocks at once, and surprising
  // the user with a prompt outside of an explicit tap is bad UX. The caller
  // (Settings UI) requests auth via a tap before scheduling the first block.
  const auth = await getAuth();
  if (auth !== 'approved') {
    console.log('[ScreenTime] scheduleBlock skipped — auth status:', auth);
    return;
  }

  // Calculate end time; durations may cross midnight, in which case the
  // intervalEnd weekday needs to roll forward by one.
  let endHour = hour;
  let endMinute = minute + durationMinutes;
  endHour += Math.floor(endMinute / 60);
  endMinute = endMinute % 60;
  const endsNextDay = endHour >= 24;
  endHour = endHour % 24;

  // All blocks follow the same model: enable block-all mode and whitelist
  // only the user-defined "never block" selection. The shield raises for
  // every app outside that whitelist.
  const startActions: any[] = [
    { type: 'clearWhitelist' },
    { type: 'enableBlockAllMode' },
    {
      type: 'addSelectionToWhitelist',
      familyActivitySelection: { activitySelectionId: NEVER_BLOCK_SELECTION_ID },
    },
    {
      type: 'sendNotification',
      payload: {
        title: 'Do Nothing',
        body: 'Time to do nothing.',
      },
    },
  ];

  // Update shield appearance
  await updateShield(SHIELD_CONFIG, SHIELD_ACTIONS);

  // Whether the block fires every day — in that case we can register a
  // single daily monitor (no weekday constraint), saving 6 slots against
  // iOS's ~20-monitor limit. Otherwise we need a separate monitor per
  // selected weekday so iOS enforces the filter natively.
  const daysSet = new Set(weekdays);
  const isEveryDay = weekdays.length === 0 || daysSet.size === 7;

  // The 15-minute [start, end] window is an iOS API requirement
  // (DeviceActivitySchedule needs an intervalEnd), not user-facing —
  // the user only chose a start time. If we register a monitor while
  // the current time is inside that window on the same weekday, iOS
  // fires intervalDidStart immediately. Skip just that occurrence so a
  // user configuring a block at 14:05 for a 14:00 schedule doesn't get
  // blocked as they finish tapping. Other weekdays register normally;
  // the skipped occurrence gets registered the next time init() runs.
  const now = new Date();
  const todayWeekday = now.getDay() + 1; // iOS convention: 1=Sun..7=Sat
  const nowMin = now.getHours() * 60 + now.getMinutes();
  const startMin = hour * 60 + minute;
  const endMin = startMin + durationMinutes;
  const nowInsideTodayWindow =
    endMin <= 24 * 60
      ? nowMin >= startMin && nowMin < endMin
      : nowMin >= startMin || nowMin < endMin - 24 * 60;

  type Schedule = { name: string; weekday: number | null };
  const schedules: Schedule[] = isEveryDay
    ? [{ name: `block-${blockId}`, weekday: null }]
    : weekdays.map((w) => ({ name: blockActivityName(blockId, w), weekday: w }));

  for (const { name, weekday } of schedules) {
    // Actions are read from UserDefaults by the extension at fire time.
    // Always configure them — even if we skip startMonitoring for today's
    // insideWindow case, the next registration (on app relaunch) already
    // has them keyed by this activityName.
    configureActions({
      activityName: name,
      callbackName: 'intervalDidStart',
      actions: startActions,
    });

    // "Today's occurrence" is either the every-day schedule (always today)
    // or the weekday-specific monitor whose weekday matches today.
    const isTodayOccurrence = weekday === null || weekday === todayWeekday;
    if (isTodayOccurrence && nowInsideTodayWindow) {
      console.log(
        `[ScreenTime] Skip ${name} today — inside active window; will register on next app launch`,
      );
      continue;
    }

    const intervalStart: Record<string, number> = { hour, minute, second: 0 };
    const intervalEnd: Record<string, number> = {
      hour: endHour,
      minute: endMinute,
      second: 0,
    };
    if (weekday !== null) {
      intervalStart.weekday = weekday;
      intervalEnd.weekday = endsNextDay ? (weekday % 7) + 1 : weekday;
    }

    await startMonitoring(name, { intervalStart, intervalEnd, repeats: true }, []);
  }

  const active = getActivities();
  console.log('[ScreenTime] Active monitors:', active);
  console.log(
    `[ScreenTime] Scheduled block ${blockId} at ${hour}:${String(minute).padStart(2, '0')} (${isEveryDay ? 'daily' : `weekdays [${weekdays.join(',')}]`})`,
  );
}

export function getActiveMonitors(): string[] {
  return getActivities();
}

export function isBlockActive(): boolean {
  try {
    return isShieldActive();
  } catch {
    return false;
  }
}

export function unscheduleBlock(blockId: string): void {
  const names = ALL_WEEKDAYS.map((w) => blockActivityName(blockId, w));
  // Also stop the legacy single-monitor name in case it was registered
  // pre-upgrade and the old monitor is still active.
  names.push(`block-${blockId}`);
  stopMonitoring(names);
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

    // If user has no enabled blocks, or the shield is stuck active with no
    // valid monitor behind it, do a full reset.
    const dbEmpty = validBlockIds.size === 0;
    const shieldStuck = isBlockActive() && validBlockIds.size === 0;

    if (dbEmpty || shieldStuck) {
      console.log('[ScreenTime] Full reset (dbEmpty=%s, stuck=%s)', dbEmpty, shieldStuck);
      await forceUnblockAll();
      return;
    }

    if (orphans.length > 0) {
      console.log('[ScreenTime] Stopping orphan monitors:', orphans);
      stopMonitoring(orphans);
      try { disableBlockAllMode(); } catch {}
    }
  } catch (e) {
    console.warn('[ScreenTime] reconcile failed:', e);
  }
}
