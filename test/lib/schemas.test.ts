import {
  WeekdaysSchema,
  WEEKDAYS_FULL,
  ScheduledBlockInputSchema,
  SessionInputSchema,
  SESSION_MIN_DURATION_S,
  SESSION_MAX_DURATION_S,
  BooleanFlagSchema,
  MoodSchema,
} from '@/lib/db/schemas';

describe('WeekdaysSchema', () => {
  it('expands empty array to all 7 days', () => {
    expect(WeekdaysSchema.parse([])).toEqual([...WEEKDAYS_FULL]);
  });

  it('removes duplicates', () => {
    expect(WeekdaysSchema.parse([1, 1, 2, 3, 3])).toEqual([1, 2, 3]);
  });

  it('filters values outside [1,7]', () => {
    expect(WeekdaysSchema.parse([0, 1, 5, 8, 9])).toEqual([1, 5]);
  });

  it('returns days in ascending order', () => {
    expect(WeekdaysSchema.parse([7, 3, 5, 1])).toEqual([1, 3, 5, 7]);
  });

  it('collapses an all-invalid input back to every day', () => {
    expect(WeekdaysSchema.parse([0, 99, -2])).toEqual([...WEEKDAYS_FULL]);
  });
});

describe('ScheduledBlockInputSchema', () => {
  const valid = {
    hour: 9,
    minute: 30,
    durationMinutes: 30,
    weekdays: [1, 2, 3],
    unlockGoalMinutes: 5,
  };

  it('passes a well-formed block through', () => {
    const parsed = ScheduledBlockInputSchema.parse(valid);
    expect(parsed).toEqual(valid);
  });

  it('defaults unlockGoalMinutes to 5', () => {
    const { unlockGoalMinutes, ...rest } = valid;
    const parsed = ScheduledBlockInputSchema.parse(rest);
    expect(parsed.unlockGoalMinutes).toBe(5);
  });

  it.each([
    ['hour < 0', { ...valid, hour: -1 }],
    ['hour > 23', { ...valid, hour: 24 }],
    ['minute < 0', { ...valid, minute: -1 }],
    ['minute > 59', { ...valid, minute: 60 }],
    ['durationMinutes 0', { ...valid, durationMinutes: 0 }],
    ['durationMinutes > 480', { ...valid, durationMinutes: 481 }],
    ['unlockGoalMinutes 0', { ...valid, unlockGoalMinutes: 0 }],
    ['unlockGoalMinutes > 60', { ...valid, unlockGoalMinutes: 61 }],
    ['non-integer hour', { ...valid, hour: 9.5 }],
  ])('rejects %s', (_label, input) => {
    expect(() => ScheduledBlockInputSchema.parse(input)).toThrow();
  });

  it('normalises weekdays via WeekdaysSchema', () => {
    const parsed = ScheduledBlockInputSchema.parse({ ...valid, weekdays: [3, 1, 1] });
    expect(parsed.weekdays).toEqual([1, 3]);
  });
});

describe('SessionInputSchema', () => {
  it('exposes the documented bounds', () => {
    expect(SESSION_MIN_DURATION_S).toBe(60);
    expect(SESSION_MAX_DURATION_S).toBe(24 * 60 * 60);
  });

  it('accepts a 60-second session at the boundary', () => {
    expect(() => SessionInputSchema.parse({ duration: 60 })).not.toThrow();
  });

  it('rejects sub-minute sessions', () => {
    expect(() => SessionInputSchema.parse({ duration: 59 })).toThrow();
  });

  it('rejects sessions longer than 24h', () => {
    expect(() => SessionInputSchema.parse({ duration: 24 * 60 * 60 + 1 })).toThrow();
  });

  it('rejects non-integer duration', () => {
    expect(() => SessionInputSchema.parse({ duration: 60.5 })).toThrow();
  });
});

describe('BooleanFlagSchema', () => {
  it('accepts the literal "1"', () => {
    expect(BooleanFlagSchema.parse('1')).toBe('1');
  });

  it('rejects everything else', () => {
    for (const v of ['0', 'true', '', 'yes', 1, true, null]) {
      expect(() => BooleanFlagSchema.parse(v as unknown as string)).toThrow();
    }
  });
});

describe('MoodSchema', () => {
  it('accepts each canonical mood', () => {
    for (const m of ['still', 'lighter', 'refreshed', 'full']) {
      expect(MoodSchema.parse(m)).toBe(m);
    }
  });

  it('rejects unknown moods', () => {
    expect(() => MoodSchema.parse('happy')).toThrow();
  });
});
