import {
  requestAuthorization,
  getAuthorizationStatus,
  blockSelection,
  unblockSelection,
  isAvailable,
  updateShield,
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
