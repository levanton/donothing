jest.mock('react-native-device-activity', () => ({
  copyFile: jest.fn(),
  getAppGroupFileDirectory: jest.fn(),
  isShieldActive: jest.fn(),
  onDeviceActivityMonitorEvent: jest.fn(),
}));
// Asset.loadAsync is used by copyShieldIcon; stub at module level so
// it doesn't try to resolve a require() bundle path in node.
jest.mock('expo-asset', () => ({
  Asset: { loadAsync: jest.fn() },
}));

import {
  isShieldActive,
  onDeviceActivityMonitorEvent,
} from 'react-native-device-activity';
import {
  NEVER_BLOCK_SELECTION_ID,
  SHIELD_CONFIG,
  SHIELD_ACTIONS,
  isBlockActive,
  onBlockShieldRaised,
} from '@/lib/screen-time/shield';

// Published types in react-native-device-activity are narrow — cast
// through any so mockReturnValue / mockImplementation accept fixtures.
const isActive = isShieldActive as unknown as jest.Mock<any>;
const onEvent = onDeviceActivityMonitorEvent as unknown as jest.Mock<any>;

beforeEach(() => {
  isActive.mockReset();
  onEvent.mockReset();
});

describe('SHIELD constants', () => {
  it('exposes the never-block sentinel selection id', () => {
    expect(NEVER_BLOCK_SELECTION_ID).toBe('nothing-never-block');
  });

  it('SHIELD_CONFIG carries the expected copy and color shape', () => {
    expect(SHIELD_CONFIG.title).toBe('Nothing');
    expect(SHIELD_CONFIG.titleColor.red).toBe(43);
    expect(SHIELD_CONFIG.backgroundColor.alpha).toBe(1);
  });

  it('SHIELD_ACTIONS routes both buttons to the close behaviour', () => {
    expect(SHIELD_ACTIONS.primary.behavior).toBe('close');
    // `secondary` is typed as optional in the library type — assert
    // its presence so the .behavior read is type-safe.
    expect(SHIELD_ACTIONS.secondary).toBeDefined();
    expect(SHIELD_ACTIONS.secondary!.behavior).toBe('close');
  });
});

describe('isBlockActive', () => {
  it('returns the native shield state when the call succeeds', () => {
    isActive.mockReturnValue(true);
    expect(isBlockActive()).toBe(true);
  });

  it('falls back to false when the native module throws', () => {
    isActive.mockImplementation(() => {
      throw new Error('native bridge unavailable');
    });
    expect(isBlockActive()).toBe(false);
  });
});

describe('onBlockShieldRaised', () => {
  it('forwards only intervalDidStart events to the listener', () => {
    let captured: ((e: { callbackName: string }) => void) | null = null;
    onEvent.mockImplementation((cb: any) => {
      captured = cb;
      return jest.fn();
    });

    const listener = jest.fn();
    onBlockShieldRaised(listener);

    expect(captured).not.toBeNull();
    captured!({ callbackName: 'intervalDidStart' });
    captured!({ callbackName: 'intervalDidEnd' });
    captured!({ callbackName: 'somethingElse' });

    expect(listener).toHaveBeenCalledTimes(1);
  });
});
