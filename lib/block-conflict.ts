import type { ScheduledBlock } from '@/lib/db/types';
import { formatTime12 } from '@/components/TimePicker';

/**
 * Minimum wall-clock gap (in minutes) required between any two scheduled
 * blocks. Used to reject duplicates and near-duplicates. Tweak here to
 * widen or narrow the spacing — both Settings and onboarding read this.
 */
export const MIN_BLOCK_GAP_MINUTES = 60;

export const MIN_BLOCK_GAP_LABEL =
  MIN_BLOCK_GAP_MINUTES === 60
    ? 'an hour'
    : MIN_BLOCK_GAP_MINUTES % 60 === 0
      ? `${MIN_BLOCK_GAP_MINUTES / 60} hours`
      : `${MIN_BLOCK_GAP_MINUTES} minutes`;

/**
 * Find an existing block within MIN_BLOCK_GAP_MINUTES of the proposed
 * start time. Distance is wall-clock and circular over 24h, so 23:50
 * collides with 00:30. Pass `ignoreId` when editing an existing block
 * so it doesn't count itself as a conflict. Returns the conflicting
 * block's formatted time (e.g., "9:00 PM") or null.
 */
export function findBlockConflict(
  blocks: ScheduledBlock[],
  hour: number,
  minute: number,
  ignoreId?: string,
): string | null {
  const startMin = hour * 60 + minute;
  for (const b of blocks) {
    if (ignoreId && b.id === ignoreId) continue;
    const otherMin = b.hour * 60 + b.minute;
    const d = Math.abs(startMin - otherMin);
    const circular = Math.min(d, 24 * 60 - d);
    if (circular < MIN_BLOCK_GAP_MINUTES) {
      return formatTime12(b.hour, b.minute);
    }
  }
  return null;
}
