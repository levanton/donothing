// Typed shape of the action payloads we hand to react-native-device-activity's
// `configureActions`. The package's own .d.ts is intentionally permissive
// (`actions: any[]`) because actions are JSON-serialized into UserDefaults and
// read back by the native extension at fire time. Internally we want type
// safety so a typo in `enableBlockAllMode` doesn't slip through.
//
// `as ShieldAction` casts may still be required at the call site where these
// objects cross into the package's narrower `ShieldActions` type.

export interface NotificationActionPayload {
  title: string;
  body: string;
  /**
   * Either a bundled .caf basename (e.g. `'block_start.caf'`) or one of the
   * iOS system constants `'default' | 'defaultCritical' | 'defaultRingtone'`.
   * Custom filenames are routed through `UNNotificationSound(named:)` by our
   * patched react-native-device-activity Shared.swift.
   */
  sound?: string;
  /**
   * `'timeSensitive'` breaks through Focus / Do Not Disturb. Requires the
   * `Time Sensitive Notifications` capability on the app target.
   */
  interruptionLevel?: 'passive' | 'active' | 'timeSensitive' | 'critical';
}

export type DeviceActivityAction =
  | { type: 'clearWhitelist' }
  | { type: 'enableBlockAllMode' }
  | { type: 'disableBlockAllMode' }
  | {
      type: 'addSelectionToWhitelist';
      familyActivitySelection:
        | { activitySelectionId: string }
        | { activitySelectionToken: string };
    }
  | { type: 'openApp' }
  | { type: 'sendNotification'; payload: NotificationActionPayload };
