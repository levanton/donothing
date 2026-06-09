import { requireOptionalNativeModule } from 'expo-modules-core';

interface CoreHapticsNativeModule {
  isSupported(): boolean;
  playSwell(duration?: number, intensity?: number): Promise<void>;
}

// Optional: returns null until the native module is compiled into the build,
// so JS keeps working in Expo Go / before the next `npm run build:ios`.
const Native = requireOptionalNativeModule<CoreHapticsNativeModule>('CoreHaptics');

/** True only on a real device with a Taptic Engine and the native module built in. */
export function isSupported(): boolean {
  try {
    return Native?.isSupported() ?? false;
  } catch {
    return false;
  }
}

/**
 * Play one smooth, continuous swelling vibration (Core Haptics).
 * @param duration total length in seconds (default 1.3)
 * @param intensity 0…1 peak strength (default 1.0)
 * Resolves immediately even if unsupported — never throws.
 */
export async function playSwell(duration?: number, intensity?: number): Promise<void> {
  try {
    await Native?.playSwell(duration, intensity);
  } catch {
    // no-op — caller falls back to discrete haptics
  }
}

export default { isSupported, playSwell };
