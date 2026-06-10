import { findActiveBlock } from '@/lib/active-block';
import type { ScheduledBlock } from '@/lib/db/types';

function block(overrides: Partial<ScheduledBlock>): ScheduledBlock {
  return {
    id: 'b',
    hour: 9,
    minute: 0,
    durationMinutes: 30,
    weekdays: [],
    enabled: true,
    unlockGoalMinutes: 5,
    ...overrides,
  } as ScheduledBlock;
}

// 2026-06-10 is a Wednesday → iOS weekday 4 (1=Sun … 7=Sat).
const WED = 4;
const TUE = 3;

function at(hour: number, minute: number): Date {
  return new Date(2026, 5, 10, hour, minute);
}

describe('findActiveBlock', () => {
  it('picks the most recently started block today', () => {
    const blocks = [
      block({ id: 'morning', hour: 8, minute: 0 }),
      block({ id: 'noon', hour: 12, minute: 0 }),
      block({ id: 'evening', hour: 20, minute: 0 }),
    ];
    expect(findActiveBlock(blocks, at(13, 0))?.id).toBe('noon');
  });

  it('ignores disabled blocks and blocks not scheduled today', () => {
    const blocks = [
      block({ id: 'disabled', hour: 12, minute: 0, enabled: false }),
      block({ id: 'wrong-day', hour: 11, minute: 0, weekdays: [TUE] }),
      block({ id: 'right-day', hour: 8, minute: 0, weekdays: [WED] }),
    ];
    expect(findActiveBlock(blocks, at(13, 0))?.id).toBe('right-day');
  });

  it("attributes an overnight shield to yesterday's firing of a daily block", () => {
    // Only consulted while the shield is up — so at 07:00, before the
    // daily 20:00 block fires today, the shield belongs to yesterday's
    // firing that was never unlocked.
    const blocks = [block({ id: 'daily-evening', hour: 20, minute: 0 })];
    expect(findActiveBlock(blocks, at(7, 0))?.id).toBe('daily-evening');
  });

  it('returns null when no block could have fired today or yesterday', () => {
    // Friday-only block, asked on a Wednesday.
    const blocks = [block({ id: 'fri-only', hour: 20, minute: 0, weekdays: [6] })];
    expect(findActiveBlock(blocks, at(7, 0))).toBeNull();
  });

  it("falls back to yesterday's latest block after midnight", () => {
    // 23:30 Tuesday block; shield still up at 00:10 Wednesday. Without
    // the wrap the unlock view would lose this block's configured goal.
    const blocks = [
      block({ id: 'late-tue', hour: 23, minute: 30, weekdays: [TUE], unlockGoalMinutes: 20 }),
      block({ id: 'wed-noon', hour: 12, minute: 0, weekdays: [WED] }),
    ];
    const found = findActiveBlock(blocks, at(0, 10));
    expect(found?.id).toBe('late-tue');
    expect(found?.unlockGoalMinutes).toBe(20);
  });

  it('prefers a block that already fired today over the midnight fallback', () => {
    const blocks = [
      block({ id: 'late-tue', hour: 23, minute: 30, weekdays: [TUE] }),
      block({ id: 'wed-early', hour: 0, minute: 5, weekdays: [WED] }),
    ];
    expect(findActiveBlock(blocks, at(0, 10))?.id).toBe('wed-early');
  });
});
