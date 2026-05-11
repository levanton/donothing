/**
 * lib/screen-time/auth.ts maps the numeric DeviceActivity status to
 * a string. The native module is mocked away — we only test the
 * mapping + the idempotent requestAuth flow.
 */

jest.mock('react-native-device-activity', () => ({
  getAuthorizationStatus: jest.fn(),
  requestAuthorization: jest.fn(),
}));

import {
  getAuthorizationStatus,
  requestAuthorization,
} from 'react-native-device-activity';
import { getAuth, requestAuth } from '@/lib/screen-time/auth';

// react-native-device-activity's published return types are very
// narrow (`Promise<number>` for getAuthorizationStatus), so cast to
// `any` to allow .mockResolvedValue / .mockRejectedValue with our
// numeric-status fixtures.
const getStatus = getAuthorizationStatus as unknown as jest.Mock<any>;
const reqAuth = requestAuthorization as unknown as jest.Mock<any>;

beforeEach(() => {
  getStatus.mockReset();
  reqAuth.mockReset().mockResolvedValue(undefined as any);
});

describe('getAuth', () => {
  it.each([
    [0, 'notDetermined'],
    [1, 'denied'],
    [2, 'approved'],
  ] as const)('maps numeric status %d → %s', async (numeric, label) => {
    getStatus.mockResolvedValue(numeric as any);
    expect(await getAuth()).toBe(label);
  });

  it('returns notDetermined for unknown numeric values', async () => {
    getStatus.mockResolvedValue(99 as any);
    expect(await getAuth()).toBe('notDetermined');
  });

  it('returns notDetermined when the native call rejects', async () => {
    getStatus.mockRejectedValue(new Error('boom'));
    expect(await getAuth()).toBe('notDetermined');
  });
});

describe('requestAuth', () => {
  it('skips the system prompt when already approved', async () => {
    getStatus.mockResolvedValue(2 as any); // approved
    expect(await requestAuth()).toBe('approved');
    expect(reqAuth).not.toHaveBeenCalled();
  });

  it('skips the system prompt when already denied', async () => {
    getStatus.mockResolvedValue(1 as any); // denied
    expect(await requestAuth()).toBe('denied');
    expect(reqAuth).not.toHaveBeenCalled();
  });

  it('shows the prompt and re-reads the status when notDetermined', async () => {
    // First call returns notDetermined, second (after request) returns approved.
    getStatus
      .mockResolvedValueOnce(0 as any)
      .mockResolvedValueOnce(2 as any);
    expect(await requestAuth()).toBe('approved');
    expect(reqAuth).toHaveBeenCalledWith('individual');
  });

  it('returns denied when the native request throws', async () => {
    getStatus.mockResolvedValue(0 as any);
    reqAuth.mockRejectedValue(new Error('user cancelled'));
    expect(await requestAuth()).toBe('denied');
  });
});
