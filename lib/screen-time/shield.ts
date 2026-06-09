import {
  copyFile,
  getAppGroupFileDirectory,
  isShieldActive,
  onDeviceActivityMonitorEvent,
  type ShieldActions,
} from 'react-native-device-activity';
import { Asset } from 'expo-asset';

export const NEVER_BLOCK_SELECTION_ID = 'nothing-never-block';

const SHIELD_ICON_FILENAME = 'shield-icon.png';

// Colors in 0-255 range (native getColor divides by 255)
export const SHIELD_CONFIG = {
  title: 'Nothing',
  titleColor: { red: 43, green: 37, blue: 34, alpha: 1.0 },
  subtitle: 'time to do nothing.',
  subtitleColor: { red: 43, green: 37, blue: 34, alpha: 0.55 },
  backgroundColor: { red: 249, green: 243, blue: 224, alpha: 1.0 },
  primaryButtonLabel: 'Open Nothing',
  primaryButtonLabelColor: { red: 255, green: 255, blue: 255, alpha: 1.0 },
  primaryButtonBackgroundColor: { red: 199, green: 91, blue: 58, alpha: 1.0 },
  secondaryButtonLabel: 'Close',
  secondaryButtonLabelColor: { red: 43, green: 37, blue: 34, alpha: 0.4 },
  iconAppGroupRelativePath: SHIELD_ICON_FILENAME,
};

export const SHIELD_ACTIONS: ShieldActions = {
  primary: {
    behavior: 'close',
    actions: [
      { type: 'openApp' },
      {
        type: 'sendNotification',
        payload: {
          title: 'Nothing',
          body: 'Tap to open Nothing',
          // Package .d.ts narrows `sound` to system constants, but iOS
          // accepts any bundled .caf filename via UNNotificationSound — see
          // patches/react-native-device-activity+0.6.1.patch.
          sound: 'block_start.caf' as 'default',
          // Same .d.ts gap on `interruptionLevel`: 'timeSensitive' is a real
          // iOS UNNotificationInterruptionLevel value and breaks through
          // Focus mode — wanted for scheduled-block alerts.
          interruptionLevel: 'timeSensitive' as 'active',
        },
      },
    ],
  },
  secondary: { behavior: 'close' },
};

export async function copyShieldIcon(): Promise<void> {
  try {
    const [asset] = await Asset.loadAsync(
      require('@/assets/images/shield-icon.png'),
    );
    const appGroupDir = getAppGroupFileDirectory();
    if (asset.localUri && appGroupDir) {
      copyFile(asset.localUri, `${appGroupDir}/${SHIELD_ICON_FILENAME}`, true);
    }
  } catch (e) {
    console.warn('Failed to copy shield icon:', e);
  }
}

export function isBlockActive(): boolean {
  try {
    return isShieldActive();
  } catch {
    return false;
  }
}

/**
 * Fires whenever the native DeviceActivity extension starts a scheduled
 * interval — i.e. the moment the shield goes up. Delivered via a Darwin
 * notification, so it's reliable in foreground where
 * `Notifications.addNotificationReceivedListener` can be silently dropped.
 */
export function onBlockShieldRaised(listener: () => void) {
  return onDeviceActivityMonitorEvent((event) => {
    if (event.callbackName === 'intervalDidStart') listener();
  });
}
