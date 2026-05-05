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
  title: 'Nothing',
  titleColor: { red: 43, green: 37, blue: 34, alpha: 1.0 },
  subtitle: 'time to do nothing.',
  subtitleColor: { red: 43, green: 37, blue: 34, alpha: 0.55 },
  backgroundColor: { red: 249, green: 243, blue: 224, alpha: 1.0 },
  primaryButtonLabel: 'Open Nothing',
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
          title: 'Nothing',
          body: 'Tap to open Nothing',
          // The package's .d.ts narrows `sound` to system constants, but
          // iOS accepts any bundled .caf filename via UNNotificationSound.
          sound: 'block_start.caf' as 'default',
          // Same .d.ts gap on `interruptionLevel`: 'timeSensitive' is a
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

// Compute the next future moment when a block should fire, given hour/minute
// and a weekday filter (1=Sun..7=Sat, or empty/all for daily). Returns null
// when no day in the next week matches (only possible if weekdays is empty
// AND somehow today's hour/minute is already past — caller should treat
// null as "no first-fire shadow needed").
function nextFireDate(hour: number, minute: number, weekdays: number[]): Date | null {
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
    if (candidate.getTime() <= now.getTime() + 30 * 1000) continue; // need ≥30s lead
    const candWeekday = candidate.getDay() + 1; // iOS convention
    if (weekdays.length === 0 || weekdays.includes(candWeekday)) {
      return candidate;
    }
  }
  return null;
}

// iOS DeviceActivity rejects any schedule whose [intervalStart, intervalEnd]
// window is shorter than 15 minutes — `startMonitoring` throws "The activity's
// schedule is too short" and silently fails to register. The UI lets users
// pick durations like 5 or 10 min for product reasons, so we floor the
// native window here while preserving the user-visible duration in the DB.
const MIN_NATIVE_SCHEDULE_MINUTES = 15;

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

  const nativeDurationMinutes = Math.max(MIN_NATIVE_SCHEDULE_MINUTES, durationMinutes);

  // Calculate end time; durations may cross midnight, in which case the
  // intervalEnd weekday needs to roll forward by one.
  let endHour = hour;
  let endMinute = minute + nativeDurationMinutes;
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
        title: 'Nothing',
        body: 'Time to do nothing.',
        // The package's .d.ts narrows `sound` to system constants, but
        // iOS accepts any bundled .caf filename via UNNotificationSound
        // (see patches/react-native-device-activity+0.6.1.patch).
        sound: 'block_start.caf' as 'default',
        // 'timeSensitive' (real iOS UNNotificationInterruptionLevel) breaks
        // through Focus / Do Not Disturb so the user hears the chime even
        // when their phone is locked into a focus mode.
        interruptionLevel: 'timeSensitive' as 'active',
      },
    },
  ];

  // Update shield appearance
  await updateShield(SHIELD_CONFIG, SHIELD_ACTIONS);

  // One-shot monitor for the very next future occurrence, with FULL date
  // components (year/month/day/hour/minute) and `repeats: false`. iOS
  // honours an exact date+time + non-repeating reliably; `repeats: true`
  // with only hour/minute is silently dropped when registered inside the
  // current cycle (or even just before it). Re-registration happens on
  // each app cold-start through the init flow, which picks the next valid
  // date forward as `nextFireDate` walks weekdays.
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
    actions: startActions,
  });
  await startMonitoring(
    name,
    {
      intervalStart: {
        year: firstFire.getFullYear(),
        month: firstFire.getMonth() + 1, // iOS uses 1-12
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

  console.log(
    `[ScreenTime] Scheduled block ${blockId} for ${firstFire.toISOString()}`,
  );
  console.log('[ScreenTime] Active monitors:', getActivities());
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
  // Cover every name shape we may have registered across upgrades:
  //   block-{id}        — current (and legacy single-monitor)
  //   block-{id}-1..7   — legacy per-weekday monitors
  //   block-{id}-once   — legacy one-shot shadow used briefly during the
  //                       recurring+shadow approach
  const names = ALL_WEEKDAYS.map((w) => blockActivityName(blockId, w));
  names.push(`block-${blockId}`);
  names.push(`block-${blockId}-once`);
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
