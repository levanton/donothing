import { Platform, Settings } from 'react-native';

/** Zero-pad a single integer to 2 digits ("5" → "05"). */
export function pad2(n: number): string {
  return String(n).padStart(2, '0');
}

/**
 * Whether the user's device prefers 24-hour clock display.
 *
 * On iOS we first honour the explicit Settings → General → Date & Time →
 * 24-Hour Time toggle (exposed via NSUserDefaults as
 * AppleICUForce24HourTime / AppleICUForce12HourTime). Read via `Settings.get`
 * so a toggle change is picked up as soon as the user comes back to the app —
 * no relaunch required. When the user hasn't overridden it, we fall back to
 * the locale's default by sniffing how `toLocaleTimeString` renders 13:00.
 */
export function uses24HourClock(): boolean {
  if (Platform.OS === 'ios') {
    const force24 = Settings.get('AppleICUForce24HourTime');
    const force12 = Settings.get('AppleICUForce12HourTime');
    if (force24 === 1 || force24 === true || force24 === '1') return true;
    if (force12 === 1 || force12 === true || force12 === '1') return false;
  }

  try {
    const sample = new Date(2000, 0, 1, 13, 0).toLocaleTimeString(undefined, { hour: 'numeric' });
    return !/AM|PM/i.test(sample);
  } catch {
    return false;
  }
}

export interface ClockParts {
  /** Already formatted: zero-padded "09" in 24h, "9" in 12h. */
  hour: string;
  /** Always zero-padded "05". */
  minute: string;
  /** "AM"/"PM" on 12h devices, null on 24h. */
  ampm: 'AM' | 'PM' | null;
}

/**
 * Single source of truth for splitting an internal 0–23 hour into the
 * pieces that get displayed. Use this when you need the components
 * separately (e.g. TimePicker columns); use {@link formatClockTime}
 * for a one-shot string.
 */
export function clockParts(hour: number, minute: number): ClockParts {
  const is24 = uses24HourClock();
  return {
    hour: is24 ? pad2(hour) : String(hour % 12 || 12),
    minute: pad2(minute),
    ampm: is24 ? null : hour < 12 ? 'AM' : 'PM',
  };
}

/**
 * Time-of-day in the user's preferred clock format.
 * Returns "14:30" on 24-hour devices and "2:30 PM" on 12-hour devices.
 */
export function formatClockTime(hour: number, minute: number): string {
  const p = clockParts(hour, minute);
  return p.ampm ? `${p.hour}:${p.minute} ${p.ampm}` : `${p.hour}:${p.minute}`;
}

export function timerDisplay(seconds: number): string {
  // Always render as MM:SS — slider tops out at 60 min so the hours
  // form was never reachable in the running screen, and "60:00"
  // reads more cleanly than "1:00:00".
  const m = Math.floor(seconds / 60);
  const s = seconds % 60;
  return `${String(m).padStart(2, '0')}:${String(s).padStart(2, '0')}`;
}

export function formatTimeShort(seconds: number): string {
  if (seconds < 60) return `${seconds}s`;

  const h = Math.floor(seconds / 3600);
  const m = Math.floor((seconds % 3600) / 60);
  const s = seconds % 60;

  if (h > 0) {
    return m > 0 ? `${h}h ${m}m` : `${h}h`;
  }
  return s > 0 ? `${m}m ${s}s` : `${m}m`;
}

/**
 * For the hero duration — returns the value as a list of (number, unit)
 * pairs so the renderer can style number and unit differently and render
 * "2 hr 49 min" rather than "2:49 hr". Renderer should drop pairs with
 * zero values (already filtered here).
 */
export function formatHeroDuration(seconds: number): Array<{ value: string; unit: string }> {
  const d = Math.floor(seconds / 86400);
  const h = Math.floor((seconds % 86400) / 3600);
  const m = Math.floor((seconds % 3600) / 60);

  if (d > 0) {
    const out = [{ value: String(d), unit: d === 1 ? 'day' : 'days' }];
    if (h > 0) out.push({ value: String(h), unit: 'hr' });
    return out;
  }
  if (h === 0) return [{ value: String(m), unit: 'min' }];
  if (m === 0) return [{ value: String(h), unit: 'hr' }];
  return [
    { value: String(h), unit: 'hr' },
    { value: String(m), unit: 'min' },
  ];
}

/** For stats display — returns { value, unit } for split rendering */
export function formatTimeStat(seconds: number): { value: string; unit: string } {
  const d = Math.floor(seconds / 86400);
  const h = Math.floor((seconds % 86400) / 3600);
  const m = Math.floor((seconds % 3600) / 60);

  if (d > 0) {
    if (h === 0) return { value: `${d}`, unit: d === 1 ? 'day' : 'days' };
    return { value: `${d}d ${h}h`, unit: '' };
  }
  if (h === 0) return { value: `${m}`, unit: 'min' };
  if (m === 0) return { value: `${h}`, unit: 'hr' };
  return { value: `${h}:${String(m).padStart(2, '0')}`, unit: 'hr' };
}
