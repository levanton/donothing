import { loadDbModules, resetDbState } from './helpers';

afterEach(resetDbState);

describe('settings table (syncable)', () => {
  it('returns null for missing keys', () => {
    const { settings } = loadDbModules();
    expect(settings.getSetting('missing')).toBeNull();
  });

  it('round-trips a value', () => {
    const { settings } = loadDbModules();
    settings.setSetting('onboardingComplete', '1');
    expect(settings.getSetting('onboardingComplete')).toBe('1');
  });

  it('overwrites on conflict instead of duplicating', () => {
    const { settings } = loadDbModules();
    settings.setSetting('weekStart', 'monday');
    settings.setSetting('weekStart', 'sunday');
    expect(settings.getSetting('weekStart')).toBe('sunday');
  });
});

describe('device_state table (local-only)', () => {
  it('round-trips and deletes', () => {
    const { settings } = loadDbModules();
    settings.setDeviceState('lastSync', '12345');
    expect(settings.getDeviceState('lastSync')).toBe('12345');
    settings.deleteDeviceState('lastSync');
    expect(settings.getDeviceState('lastSync')).toBeNull();
  });
});

describe('notification-state', () => {
  it('returns an empty array when nothing stored', () => {
    const { notifState } = loadDbModules();
    expect(notifState.getNotificationIds('block', 'b1')).toEqual([]);
  });

  it('stores and retrieves IDs', () => {
    const { notifState } = loadDbModules();
    notifState.setNotificationIds('block', 'b1', ['n1', 'n2']);
    expect(notifState.getNotificationIds('block', 'b1')).toEqual(['n1', 'n2']);
  });

  it('clear empties the stored set', () => {
    const { notifState } = loadDbModules();
    notifState.setNotificationIds('block', 'b1', ['n1']);
    notifState.clearNotificationIds('block', 'b1');
    expect(notifState.getNotificationIds('block', 'b1')).toEqual([]);
  });

  it('returns [] when the stored value is malformed JSON', () => {
    const { settings, notifState } = loadDbModules();
    settings.setDeviceState('notification_ids:block:b1', 'not-json');
    expect(notifState.getNotificationIds('block', 'b1')).toEqual([]);
  });

  it('returns [] when the stored value is valid JSON but not an array', () => {
    const { settings, notifState } = loadDbModules();
    settings.setDeviceState('notification_ids:block:b1', '123');
    expect(notifState.getNotificationIds('block', 'b1')).toEqual([]);
    settings.setDeviceState('notification_ids:block:b1', '{"a":1}');
    expect(notifState.getNotificationIds('block', 'b1')).toEqual([]);
  });

  it('drops non-string entries from a stored array', () => {
    const { settings, notifState } = loadDbModules();
    settings.setDeviceState('notification_ids:block:b1', '["n1", 5, null, "n2"]');
    expect(notifState.getNotificationIds('block', 'b1')).toEqual(['n1', 'n2']);
  });
});
