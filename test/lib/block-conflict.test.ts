import {
  MIN_BLOCK_GAP_MINUTES,
  MIN_BLOCK_GAP_LABEL,
  findBlockConflict,
} from '@/lib/block-conflict';
import type { ScheduledBlock } from '@/lib/db/types';
// 24h-clock mock lives in test/jest.setup.ts so the formatted conflict
// string is predictable across machines.

function block(overrides: Partial<ScheduledBlock>): ScheduledBlock {
  return {
    id: overrides.id ?? 'b1',
    hour: overrides.hour ?? 9,
    minute: overrides.minute ?? 0,
    durationMinutes: 30,
    weekdays: [1, 2, 3, 4, 5, 6, 7],
    enabled: true,
    unlockGoalMinutes: 5,
    ...overrides,
  };
}

describe('MIN_BLOCK_GAP_MINUTES & label', () => {
  it('exposes a 60-minute gap with the right human label', () => {
    expect(MIN_BLOCK_GAP_MINUTES).toBe(60);
    expect(MIN_BLOCK_GAP_LABEL).toBe('an hour');
  });
});

describe('findBlockConflict', () => {
  it('returns null with no existing blocks', () => {
    expect(findBlockConflict([], 9, 0)).toBeNull();
  });

  it('flags a block at the exact same time', () => {
    const blocks = [block({ id: 'a', hour: 9, minute: 0 })];
    expect(findBlockConflict(blocks, 9, 0)).toBe('09:00');
  });

  it('flags a block 30 minutes away (inside the 60-minute window)', () => {
    const blocks = [block({ id: 'a', hour: 9, minute: 0 })];
    expect(findBlockConflict(blocks, 9, 30)).toBe('09:00');
  });

  it('does not flag a block exactly one hour away', () => {
    const blocks = [block({ id: 'a', hour: 9, minute: 0 })];
    expect(findBlockConflict(blocks, 10, 0)).toBeNull();
  });

  it('uses circular distance — 23:50 conflicts with 00:30', () => {
    const blocks = [block({ id: 'a', hour: 23, minute: 50 })];
    expect(findBlockConflict(blocks, 0, 30)).toBe('23:50');
  });

  it('ignores the block being edited (ignoreId)', () => {
    const blocks = [block({ id: 'self', hour: 9, minute: 0 })];
    expect(findBlockConflict(blocks, 9, 0, 'self')).toBeNull();
  });

  it('still flags other blocks even when ignoreId is set', () => {
    const blocks = [
      block({ id: 'self', hour: 8, minute: 0 }),
      block({ id: 'other', hour: 9, minute: 30 }),
    ];
    expect(findBlockConflict(blocks, 9, 0, 'self')).toBe('09:30');
  });
});
