/**
 * lib/screen-time/schedule.ts orchestrates native DeviceActivity calls
 * for block scheduling. We mock react-native-device-activity entirely
 * and assert on what gets called — the goal is to verify the
 * orchestration logic (auth gating, orphan filtering, full-reset path)
 * not the native bridge.
 */

jest.mock('react-native-device-activity', () => ({
  configureActions: jest.fn(),
  disableBlockAllMode: jest.fn(),
  getActivities: jest.fn(),
  resetBlocks: jest.fn(),
  startMonitoring: jest.fn(),
  stopMonitoring: jest.fn(),
  unblockSelection: jest.fn(),
  updateShield: jest.fn(),
  // Used by auth.ts (imported via './auth')
  getAuthorizationStatus: jest.fn(),
  requestAuthorization: jest.fn(),
  // Used by shield.ts
  copyFile: jest.fn(),
  getAppGroupFileDirectory: jest.fn(),
  isShieldActive: jest.fn(),
  onDeviceActivityMonitorEvent: jest.fn(),
}));
jest.mock('expo-asset', () => ({ Asset: { loadAsync: jest.fn() } }));

import {
  configureActions,
  disableBlockAllMode,
  getActivities,
  resetBlocks,
  startMonitoring,
  stopMonitoring,
  unblockSelection,
  updateShield,
  getAuthorizationStatus,
  isShieldActive,
} from 'react-native-device-activity';
import {
  forceUnblockAll,
  reconcileBlocks,
  scheduleBlock,
  unscheduleBlock,
} from '@/lib/screen-time/schedule';

// Published types in react-native-device-activity are narrow — cast
// through any so mockResolvedValue / mockReturnValue accept fixtures.
const activities = getActivities as unknown as jest.Mock<any>;
const startMon = startMonitoring as unknown as jest.Mock<any>;
const stopMon = stopMonitoring as unknown as jest.Mock<any>;
const shieldActive = isShieldActive as unknown as jest.Mock<any>;
const authStatus = getAuthorizationStatus as unknown as jest.Mock<any>;

beforeEach(() => {
  (configureActions as jest.Mock).mockReset();
  (disableBlockAllMode as jest.Mock).mockReset();
  activities.mockReset().mockReturnValue([]);
  (resetBlocks as jest.Mock).mockReset();
  startMon.mockReset().mockResolvedValue(undefined as any);
  stopMon.mockReset();
  (unblockSelection as jest.Mock).mockReset().mockResolvedValue(undefined);
  (updateShield as jest.Mock).mockReset().mockResolvedValue(undefined);
  shieldActive.mockReset().mockReturnValue(false);
  authStatus.mockReset().mockResolvedValue(2 as any); // approved
  jest.spyOn(console, 'log').mockImplementation(() => {});
  jest.spyOn(console, 'warn').mockImplementation(() => {});
});

afterEach(() => {
  jest.restoreAllMocks();
});

describe('scheduleBlock', () => {
  it('skips entirely when auth is not approved', async () => {
    authStatus.mockResolvedValue(0 as any); // notDetermined
    await scheduleBlock('b1', 9, 0, 30, []);
    expect(startMon).not.toHaveBeenCalled();
    expect(updateShield).not.toHaveBeenCalled();
  });

  it('registers a one-shot monitor and updates the shield when approved', async () => {
    // Pin time so nextFireDate is deterministic — 2026-05-13 (Wed) 08:00,
    // schedule for 09:00 same day so the fire is today + ≥30s.
    jest.useFakeTimers().setSystemTime(new Date(2026, 4, 13, 8, 0, 0));
    try {
      await scheduleBlock('b1', 9, 0, 30, []);
      expect(updateShield).toHaveBeenCalledTimes(1);
      expect(configureActions).toHaveBeenCalledWith(
        expect.objectContaining({
          activityName: 'block-b1',
          callbackName: 'intervalDidStart',
        }),
      );
      expect(startMon).toHaveBeenCalledWith(
        'block-b1',
        expect.objectContaining({
          intervalStart: expect.objectContaining({ hour: 9, minute: 0 }),
          repeats: false,
        }),
        [],
      );
    } finally {
      jest.useRealTimers();
    }
  });

  it('rolls to next valid weekday when the requested time today is past', async () => {
    // Wed 10:00; schedule for 09:00 only on Sundays (weekday 1).
    jest.useFakeTimers().setSystemTime(new Date(2026, 4, 13, 10, 0, 0));
    try {
      await scheduleBlock('b2', 9, 0, 30, [1]);
      const callArgs = startMon.mock.calls[0]?.[1] as any;
      // Sunday after May 13, 2026 is May 17.
      expect(callArgs.intervalStart.year).toBe(2026);
      expect(callArgs.intervalStart.month).toBe(5);
      expect(callArgs.intervalStart.day).toBe(17);
    } finally {
      jest.useRealTimers();
    }
  });
});

describe('unscheduleBlock', () => {
  it('passes every legacy name shape for the id to stopMonitoring', () => {
    unscheduleBlock('abc');
    const names = stopMon.mock.calls[0]?.[0] as string[];
    expect(names).toEqual(
      expect.arrayContaining([
        'block-abc',
        'block-abc-1',
        'block-abc-2',
        'block-abc-3',
        'block-abc-4',
        'block-abc-5',
        'block-abc-6',
        'block-abc-7',
        'block-abc-once',
      ]),
    );
  });
});

describe('forceUnblockAll', () => {
  it('drops every monitor, kills block-all mode, resets, and unblocks the sentinel', async () => {
    await forceUnblockAll();
    expect(stopMon).toHaveBeenCalledWith(); // no-arg = all
    expect(disableBlockAllMode).toHaveBeenCalled();
    expect(resetBlocks).toHaveBeenCalled();
    expect(unblockSelection).toHaveBeenCalledWith({
      activitySelectionId: 'nothing-never-block',
    });
  });

  it('keeps going even when individual native calls throw', async () => {
    (stopMon as jest.Mock).mockImplementation(() => {
      throw new Error('boom');
    });
    (disableBlockAllMode as jest.Mock).mockImplementation(() => {
      throw new Error('boom');
    });
    // Should still attempt the remaining steps without throwing.
    await expect(forceUnblockAll()).resolves.toBeUndefined();
    expect(resetBlocks).toHaveBeenCalled();
  });
});

describe('reconcileBlocks', () => {
  it('full-resets when validBlockIds is empty', async () => {
    activities.mockReturnValue(['block-x', 'other-thing']);
    await reconcileBlocks(new Set());
    expect(stopMon).toHaveBeenCalledWith(); // forceUnblockAll path
    expect(resetBlocks).toHaveBeenCalled();
  });

  it('full-resets when the shield is up but DB has no blocks', async () => {
    shieldActive.mockReturnValue(true);
    await reconcileBlocks(new Set());
    expect(resetBlocks).toHaveBeenCalled();
  });

  it('stops only orphan monitors, leaves valid ones alone', async () => {
    activities.mockReturnValue([
      'block-keep',
      'block-keep-1',
      'block-orphan',
      'block-orphan-3',
      'unrelated',
    ]);
    await reconcileBlocks(new Set(['keep']));
    const stopped = stopMon.mock.calls[0]?.[0] as string[];
    expect(stopped).toEqual(['block-orphan', 'block-orphan-3']);
  });

  it('does nothing when every native monitor maps to a valid id', async () => {
    activities.mockReturnValue(['block-keep', 'block-keep-1']);
    await reconcileBlocks(new Set(['keep']));
    expect(stopMon).not.toHaveBeenCalled();
  });

  it('survives an unexpected native error', async () => {
    activities.mockImplementation(() => {
      throw new Error('boom');
    });
    await expect(reconcileBlocks(new Set(['a']))).resolves.toBeUndefined();
  });
});
