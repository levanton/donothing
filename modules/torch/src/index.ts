import { requireOptionalNativeModule } from 'expo-modules-core';

interface TorchNativeModule {
  isAvailable(): boolean;
  setTorch(level: number): void;
}

// Optional: returns null until the native module is compiled into the build,
// so JS keeps working in the simulator / before the next native build.
const Native = requireOptionalNativeModule<TorchNativeModule>('Torch');

/** True only on a real device with a torch and the native module built in. */
export function isAvailable(): boolean {
  try {
    return Native?.isAvailable() ?? false;
  } catch {
    return false;
  }
}

/** Set the torch level (0 = off, 0…1 = on). Never throws. */
export function setTorch(level: number): void {
  try {
    Native?.setTorch(level);
  } catch {
    // best-effort
  }
}

const sleep = (ms: number) => new Promise<void>((r) => setTimeout(r, ms));

let blinking = false;

/**
 * Gentle end-of-session signal: by default ONE soft, sustained glow — a
 * breath of light off the table, not a strobe. Safe to call anywhere —
 * no-ops without hardware, never overlaps itself, never throws.
 *
 * Level 0.1 is a candle-glow, not a flashlight — the signal should be
 * noticeable across a room without stabbing the eyes next to it.
 */
export async function blink(times = 1, level = 0.1, onMs = 1100, offMs = 320): Promise<void> {
  if (blinking || !isAvailable()) return;
  blinking = true;
  try {
    for (let i = 0; i < times; i++) {
      setTorch(level);
      await sleep(onMs);
      setTorch(0);
      if (i < times - 1) await sleep(offMs);
    }
  } finally {
    // Whatever happens, never leave the torch burning.
    setTorch(0);
    blinking = false;
  }
}

export default { isAvailable, setTorch, blink };
