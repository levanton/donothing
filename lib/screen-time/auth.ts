import {
  getAuthorizationStatus,
  requestAuthorization,
} from 'react-native-device-activity';

export type AuthStatus = 'notDetermined' | 'denied' | 'approved';

const AUTH_MAP: Record<number, AuthStatus> = {
  0: 'notDetermined',
  1: 'denied',
  2: 'approved',
};

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
