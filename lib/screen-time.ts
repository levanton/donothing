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
} from 'react-native-device-activity';
import { Asset } from 'expo-asset';

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

const SHIELD_ACTIONS = {
  primary: {
    behavior: 'close' as const,
    actions: [
      { type: 'openApp' as const },
      {
        type: 'sendNotification' as const,
        payload: {
          title: 'Do Nothing',
          body: 'Tap to open Do Nothing',
          sound: 'default',
          interruptionLevel: 'timeSensitive',
        },
      },
    ],
  },
  secondary: { behavior: 'close' as const },
};

export const NEVER_BLOCK_SELECTION_ID = 'donothing-never-block';

export function groupSelectionId(groupId: string): string {
  return `donothing-group-${groupId}`;
}

export async function scheduleBlock(
  blockId: string,
  groupId: string | null,
  hour: number,
  minute: number,
  durationMinutes: number,
  // Reserved for future native shield-side enforcement; today only JS gates on it.
  _unlockGoalMinutes?: number,
): Promise<void> {
  const activityName = `block-${blockId}`;

  // Calculate end time
  let endHour = hour;
  let endMinute = minute + durationMinutes;
  endHour += Math.floor(endMinute / 60);
  endMinute = endMinute % 60;
  endHour = endHour % 24;

  // Ensure authorization — but never trigger the system prompt here. Init
  // and re-scheduling can call this for many blocks at once, and surprising
  // the user with a prompt outside of an explicit tap is bad UX. The caller
  // (Settings UI) requests auth via a tap before scheduling the first block.
  const auth = await getAuth();
  if (auth !== 'approved') {
    console.log('[ScreenTime] scheduleBlock skipped — auth status:', auth);
    return;
  }

  const startActions: any[] = [
    { type: 'clearWhitelist' },
  ];

  if (groupId === null) {
    // "All apps" sentinel
    startActions.push({ type: 'enableBlockAllMode' });
  } else {
    startActions.push({
      type: 'blockSelection',
      familyActivitySelectionId: groupSelectionId(groupId),
    });
  }

  startActions.push({
    type: 'addSelectionToWhitelist',
    familyActivitySelection: { activitySelectionId: NEVER_BLOCK_SELECTION_ID },
  });

  startActions.push({
    type: 'sendNotification',
    payload: {
      title: 'Do Nothing',
      body: `Time to do nothing for ${durationMinutes} minutes.`,
    },
  });

  configureActions({
    activityName,
    callbackName: 'intervalDidStart',
    actions: startActions,
  });

  // No action on intervalDidEnd — user must unlock manually via the app

  // Update shield appearance
  await updateShield(SHIELD_CONFIG, SHIELD_ACTIONS);

  // iOS DeviceActivityMonitor fires intervalDidStart immediately if the current
  // time is inside the [start, end] window. That would block apps right as the
  // user adds the block. Skip registration this cycle if we're inside — it will
  // fire normally on the next occurrence (tomorrow).
  const now = new Date();
  const nowMin = now.getHours() * 60 + now.getMinutes();
  const startMin = hour * 60 + minute;
  const endMin = startMin + durationMinutes;
  const insideWindow =
    endMin <= 24 * 60
      ? nowMin >= startMin && nowMin < endMin
      : nowMin >= startMin || nowMin < endMin - 24 * 60;

  if (insideWindow) {
    console.log('[ScreenTime] Current time inside window — deferring registration to next cycle');
    return;
  }

  // Start monitoring with the schedule
  await startMonitoring(
    activityName,
    {
      intervalStart: { hour, minute, second: 0 },
      intervalEnd: { hour: endHour, minute: endMinute, second: 0 },
      repeats: true,
    },
    [],
  );

  // Debug: verify monitoring is active
  const active = getActivities();
  console.log('[ScreenTime] Active monitors:', active);
  console.log(`[ScreenTime] Scheduled: ${activityName} from ${hour}:${String(minute).padStart(2, '0')} to ${endHour}:${String(endMinute).padStart(2, '0')}`);
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
  stopMonitoring([`block-${blockId}`]);
}

/**
 * Full nuclear reset — stops every monitor, drops block-all mode, resets the
 * native block list, and unblocks every known group selection. Use when the
 * DB has no blocks but the native shield is still active.
 */
export async function forceUnblockAll(knownGroupIds: string[]): Promise<void> {
  try { stopMonitoring(); } catch {}
  try { disableBlockAllMode(); } catch {}
  try { resetBlocks(); } catch {}
  try {
    await unblockSelection({ activitySelectionId: NEVER_BLOCK_SELECTION_ID });
  } catch {}
  for (const gid of knownGroupIds) {
    try {
      await unblockSelection({ activitySelectionId: groupSelectionId(gid) });
    } catch {}
  }
}

/**
 * Stop any `block-*` native monitors whose id is not in `validBlockIds`,
 * and release shield state if we cleaned anything up. Fixes the case where
 * the DB has been wiped but the native schedule/shield is still active.
 */
export async function reconcileBlocks(
  validBlockIds: Set<string>,
  knownGroupIds: string[],
): Promise<void> {
  try {
    const active = getActivities();
    const prefix = 'block-';
    const ours = active.filter((n) => n.startsWith(prefix));
    const orphans = ours.filter(
      (n) => !validBlockIds.has(n.slice(prefix.length)),
    );

    // If user has no enabled blocks, or the shield is stuck active with no
    // valid monitor behind it, do a full reset.
    const dbEmpty = validBlockIds.size === 0;
    const shieldStuck = isBlockActive() && validBlockIds.size === 0;

    if (dbEmpty || shieldStuck) {
      console.log('[ScreenTime] Full reset (dbEmpty=%s, stuck=%s)', dbEmpty, shieldStuck);
      await forceUnblockAll(knownGroupIds);
      return;
    }

    if (orphans.length > 0) {
      console.log('[ScreenTime] Stopping orphan monitors:', orphans);
      stopMonitoring(orphans);
      try { disableBlockAllMode(); } catch {}
      for (const gid of knownGroupIds) {
        try {
          await unblockSelection({ activitySelectionId: groupSelectionId(gid) });
        } catch {}
      }
    }
  } catch (e) {
    console.warn('[ScreenTime] reconcile failed:', e);
  }
}
