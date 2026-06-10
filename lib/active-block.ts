import type { ScheduledBlock } from '@/lib/db/types';

/**
 * Pick the block that most recently fired so the unlock view surfaces
 * the unlockGoalMinutes the user configured for it. The shield persists
 * until the user unlocks, so "most recent start ≤ now" is the right
 * heuristic — durationMinutes is only an iOS API window, not an actual
 * block length.
 *
 * If nothing has fired *today* yet, fall back to yesterday's latest
 * block: a 23:30 block whose shield is still up at 00:10 belongs to
 * yesterday's weekday, and without the fallback the unlock view would
 * show the default goal instead of the one the user set.
 */
export function findActiveBlock(
  blocks: ScheduledBlock[],
  now: Date,
): ScheduledBlock | null {
  const nowMinutes = now.getHours() * 60 + now.getMinutes();
  // iOS/Expo weekday convention: 1=Sun … 7=Sat. JS Date.getDay() is 0=Sun,
  // so we offset by 1 to match what block.weekdays stores.
  const today = now.getDay() + 1;
  const yesterday = ((now.getDay() + 6) % 7) + 1;

  const latestOn = (weekday: number, maxStart: number): ScheduledBlock | null => {
    let best: ScheduledBlock | null = null;
    let bestStart = -1;
    for (const b of blocks) {
      if (!b.enabled) continue;
      if (b.weekdays.length > 0 && !b.weekdays.includes(weekday)) continue;
      const start = b.hour * 60 + b.minute;
      if (start > maxStart) continue;
      if (start > bestStart) {
        best = b;
        bestStart = start;
      }
    }
    return best;
  };

  // Yesterday's fallback has no start cap — any block that fired
  // yesterday started before midnight, i.e. before "now".
  return latestOn(today, nowMinutes) ?? latestOn(yesterday, 24 * 60);
}
