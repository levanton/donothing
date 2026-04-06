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

export async function scheduleBlock(
  blockId: string,
  selectionId: string,
  hour: number,
  minute: number,
  durationMinutes: number,
): Promise<void> {
  const activityName = `block-${blockId}`;

  // Calculate end time
  let endHour = hour;
  let endMinute = minute + durationMinutes;
  endHour += Math.floor(endMinute / 60);
  endMinute = endMinute % 60;
  endHour = endHour % 24;

  // Ensure authorization
  await requestAuth();

  // Configure what happens when interval starts: block apps
  configureActions({
    activityName,
    callbackName: 'intervalDidStart',
    actions: [
      {
        type: 'blockSelection',
        familyActivitySelectionId: selectionId,
      },
      {
        type: 'sendNotification',
        payload: {
          title: 'Do Nothing',
          body: `Time to do nothing for ${durationMinutes} minutes.`,
        },
      },
    ],
  });

  // No action on intervalDidEnd — user must unlock manually via the app

  // Update shield appearance
  await updateShield(SHIELD_CONFIG, SHIELD_ACTIONS);

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
