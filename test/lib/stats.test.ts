/**
 * stats.ts is a thin wrapper around DB getters. We mock the DB module
 * boundary so we can drive the time-bucket logic without seeding
 * SQLite with real timestamps for every test.
 */

jest.mock('@/lib/db/sessions', () => ({
  getDurationSince: jest.fn(),
  getWeekDurations: jest.fn(),
  getDistinctDatesDesc: jest.fn(),
}));

import { getDurationSince, getDistinctDatesDesc, getWeekDurations } from '@/lib/db/sessions';
import { getStats, getStreak, getWeekStats } from '@/lib/stats';

const durationMock = getDurationSince as jest.MockedFunction<typeof getDurationSince>;
const distinctDatesMock = getDistinctDatesDesc as jest.MockedFunction<typeof getDistinctDatesDesc>;
const weekDurationsMock = getWeekDurations as jest.MockedFunction<typeof getWeekDurations>;

beforeEach(() => {
  durationMock.mockReset();
  distinctDatesMock.mockReset();
  weekDurationsMock.mockReset();
});

describe('getStats', () => {
  it('queries today / week / year using the right start timestamps', () => {
    // Pin time so the day/week/year start values are deterministic and
    // distinct (Wednesday, so day-start ≠ Mon-week-start).
    jest.useFakeTimers().setSystemTime(new Date(2026, 4, 13, 14, 30, 0));
    try {
      const startOfDay = new Date(2026, 4, 13).getTime();
      const startOfWeek = new Date(2026, 4, 11).getTime(); // Monday
      const startOfYear = new Date(2026, 0, 1).getTime();

      // Route by argument value — decouples the assertion from the
      // order getStats() happens to call getDurationSince in.
      durationMock.mockImplementation((since: number) => {
        if (since === startOfDay) return 100;
        if (since === startOfWeek) return 400;
        if (since === startOfYear) return 2000;
        throw new Error(`unexpected since=${since}`);
      });

      expect(getStats()).toEqual({ today: 100, week: 400, year: 2000 });
      expect(durationMock).toHaveBeenCalledTimes(3);
    } finally {
      jest.useRealTimers();
    }
  });
});

describe('getStreak', () => {
  function key(d: Date) {
    return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`;
  }

  it('returns 0 when no dates are active', () => {
    distinctDatesMock.mockReturnValue([]);
    expect(getStreak()).toBe(0);
  });

  it('counts consecutive days ending today', () => {
    const today = new Date();
    const days: string[] = [];
    for (let i = 0; i < 5; i++) {
      const d = new Date(today);
      d.setDate(d.getDate() - i);
      days.push(key(d));
    }
    distinctDatesMock.mockReturnValue(days);
    expect(getStreak()).toBe(5);
  });

  it('stops at the first gap', () => {
    const today = new Date();
    const days = [today, new Date(today.getTime() - 86400000)]; // today + yesterday
    const gap = new Date(today.getTime() - 3 * 86400000); // 3 days ago
    distinctDatesMock.mockReturnValue([...days.map(key), key(gap)]);
    expect(getStreak()).toBe(2);
  });

  it('returns 0 when today is missing', () => {
    const yesterday = new Date(Date.now() - 86400000);
    distinctDatesMock.mockReturnValue([key(yesterday)]);
    expect(getStreak()).toBe(0);
  });
});

describe('getWeekStats', () => {
  it('always returns 7 entries with exactly one isToday', () => {
    weekDurationsMock.mockReturnValue(new Map());
    const week = getWeekStats(false); // explicit Mon-start
    expect(week).toHaveLength(7);
    expect(week.filter((d) => d.isToday)).toHaveLength(1);
  });

  it('uses Mon→Sun day names when week starts on Monday', () => {
    weekDurationsMock.mockReturnValue(new Map());
    const week = getWeekStats(false);
    expect(week.map((d) => d.dayName)).toEqual(['Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat', 'Sun']);
  });

  it('uses Sun→Sat day names when week starts on Sunday', () => {
    weekDurationsMock.mockReturnValue(new Map());
    const week = getWeekStats(true);
    expect(week.map((d) => d.dayName)).toEqual(['Sun', 'Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat']);
  });

  it('attaches durations from the DB map by date key', () => {
    const today = new Date();
    const todayKey = `${today.getFullYear()}-${String(today.getMonth() + 1).padStart(2, '0')}-${String(today.getDate()).padStart(2, '0')}`;
    weekDurationsMock.mockReturnValue(new Map([[todayKey, 600]]));
    const week = getWeekStats(false);
    expect(week.find((d) => d.isToday)?.duration).toBe(600);
    expect(week.filter((d) => !d.isToday).every((d) => d.duration === 0)).toBe(true);
  });
});
