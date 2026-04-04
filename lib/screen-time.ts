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
} from 'react-native-device-activity';

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
  await updateShield({
    title: 'Do Nothing',
    subtitle: 'This app is blocked during your focus session.',
    primaryButtonLabel: '',
    secondaryButtonLabel: '',
  }, {
    primary: { behavior: 'close' },
    secondary: { behavior: 'close' },
  });
}

export async function unblockApps(selectionToken: string): Promise<void> {
  await unblockSelection({ activitySelectionToken: selectionToken });
}

export async function blockAppsById(selectionId: string): Promise<void> {
  await blockSelection({ activitySelectionId: selectionId });
  await updateShield({
    title: 'Do Nothing',
    subtitle: 'This app is blocked during your scheduled session.',
    primaryButtonLabel: '',
    secondaryButtonLabel: '',
  }, {
    primary: { behavior: 'close' },
    secondary: { behavior: 'close' },
  });
}

export async function unblockAppsById(selectionId: string): Promise<void> {
  await unblockSelection({ activitySelectionId: selectionId });
}

const SHIELD_CONFIG = {
  title: 'Do Nothing',
  subtitle: 'Time to do nothing. Put your phone down.',
  primaryButtonLabel: '',
  secondaryButtonLabel: '',
};

const SHIELD_ACTIONS = {
  primary: { behavior: 'close' as const },
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

  // Configure what happens when interval ends: unblock
  configureActions({
    activityName,
    callbackName: 'intervalDidEnd',
    actions: [
      { type: 'resetBlocks' },
    ],
  });

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
}

export function unscheduleBlock(blockId: string): void {
  stopMonitoring([`block-${blockId}`]);
}
