/**
 * Time-bucket tests for lib/db/sessions.ts. addSession() writes
 * `timestamp = Date.now()`, so jest.useFakeTimers + setSystemTime lets
 * us insert rows at deterministic moments and then assert on the date
 * filters (date-range, distinct dates, month aggregation, delete by
 * date key, `since`).
 *
 * Timezone: better-sqlite3's `strftime(..., 'localtime')` follows the
 * process timezone, same as `new Date(year, month, day)`. As long as
 * both sides use the same TZ (host's local) the keys line up.
 */

import { loadDbModules, resetDbState } from './helpers';

const MAY_10 = new Date(2026, 4, 10, 10, 0, 0).getTime();
const MAY_10_LATE = new Date(2026, 4, 10, 23, 0, 0).getTime();
const MAY_11 = new Date(2026, 4, 11, 10, 0, 0).getTime();
const MAY_12 = new Date(2026, 4, 12, 10, 0, 0).getTime();
const JUN_1 = new Date(2026, 5, 1, 10, 0, 0).getTime();

afterEach(() => {
  resetDbState();
  jest.useRealTimers();
});

function seed(
  add: (duration: number) => unknown,
  rows: { at: number; duration: number }[],
) {
  jest.useFakeTimers();
  for (const row of rows) {
    jest.setSystemTime(row.at);
    add(row.duration);
  }
}

describe('getSessionsByDateRange', () => {
  it('returns rows in [startMs, endMs) only, newest-first', () => {
    const { sessions } = loadDbModules();
    seed(sessions.addSession, [
      { at: MAY_10, duration: 60 },
      { at: MAY_11, duration: 120 },
      { at: MAY_12, duration: 180 },
    ]);
    const start = new Date(2026, 4, 11).getTime();
    const end = new Date(2026, 4, 12).getTime();
    const rows = sessions.getSessionsByDateRange(start, end);
    expect(rows.map((r) => r.duration)).toEqual([120]);
  });

  it('returns nothing when no rows match', () => {
    const { sessions } = loadDbModules();
    seed(sessions.addSession, [{ at: MAY_10, duration: 60 }]);
    expect(sessions.getSessionsByDateRange(MAY_11, MAY_12)).toEqual([]);
  });
});

describe('getDurationSince', () => {
  it('sums durations from the cutoff onward', () => {
    const { sessions } = loadDbModules();
    seed(sessions.addSession, [
      { at: MAY_10, duration: 60 },
      { at: MAY_11, duration: 120 },
      { at: MAY_12, duration: 180 },
    ]);
    expect(sessions.getDurationSince(new Date(2026, 4, 11).getTime())).toBe(300);
  });

  it('returns 0 when the cutoff is in the future', () => {
    const { sessions } = loadDbModules();
    seed(sessions.addSession, [{ at: MAY_10, duration: 60 }]);
    expect(sessions.getDurationSince(MAY_12)).toBe(0);
  });
});

describe('getDistinctDatesDesc', () => {
  it('returns unique local-date keys newest-first, respecting limit', () => {
    const { sessions } = loadDbModules();
    seed(sessions.addSession, [
      { at: MAY_10, duration: 60 },
      { at: MAY_10_LATE, duration: 60 }, // same day, different hour
      { at: MAY_11, duration: 60 },
      { at: MAY_12, duration: 60 },
    ]);
    expect(sessions.getDistinctDatesDesc(10)).toEqual(['2026-05-12', '2026-05-11', '2026-05-10']);
    expect(sessions.getDistinctDatesDesc(2)).toEqual(['2026-05-12', '2026-05-11']);
  });
});

describe('deleteSessionsByDateKey', () => {
  it('deletes only rows that share the date key', () => {
    const { sessions } = loadDbModules();
    seed(sessions.addSession, [
      { at: MAY_10, duration: 60 },
      { at: MAY_10_LATE, duration: 90 },
      { at: MAY_11, duration: 120 },
    ]);
    sessions.deleteSessionsByDateKey('2026-05-10');
    const remaining = sessions.getAllSessions();
    expect(remaining.map((s) => s.duration)).toEqual([120]);
  });

  it('is a no-op when no rows match', () => {
    const { sessions } = loadDbModules();
    seed(sessions.addSession, [{ at: MAY_10, duration: 60 }]);
    sessions.deleteSessionsByDateKey('1999-01-01');
    expect(sessions.getSessionCount()).toBe(1);
  });
});

describe('getMonthDurations', () => {
  it('groups by date key within the month and excludes neighbours', () => {
    const { sessions } = loadDbModules();
    seed(sessions.addSession, [
      { at: MAY_10, duration: 60 },
      { at: MAY_10_LATE, duration: 60 },
      { at: MAY_11, duration: 120 },
      { at: JUN_1, duration: 180 }, // next month — must not appear
    ]);
    const map = sessions.getMonthDurations(2026, 5);
    expect(map.get('2026-05-10')).toBe(120);
    expect(map.get('2026-05-11')).toBe(120);
    expect(map.has('2026-06-01')).toBe(false);
  });

  it('returns an empty map when the month has no sessions', () => {
    const { sessions } = loadDbModules();
    seed(sessions.addSession, [{ at: MAY_10, duration: 60 }]);
    expect(sessions.getMonthDurations(2030, 1).size).toBe(0);
  });
});

describe('getActiveDaysCount', () => {
  it('counts unique local-date keys', () => {
    const { sessions } = loadDbModules();
    seed(sessions.addSession, [
      { at: MAY_10, duration: 60 },
      { at: MAY_10_LATE, duration: 60 },
      { at: MAY_11, duration: 60 },
    ]);
    expect(sessions.getActiveDaysCount()).toBe(2);
  });
});

describe('getTodayDuration', () => {
  it('sums only sessions whose timestamp is on the current local day', () => {
    const { sessions } = loadDbModules();
    // Pin "now" to noon on the 11th. The 10th rows must be excluded.
    seed(sessions.addSession, [
      { at: MAY_10, duration: 60 },
      { at: MAY_11, duration: 200 },
    ]);
    jest.useFakeTimers().setSystemTime(new Date(2026, 4, 11, 12, 0, 0));
    expect(sessions.getTodayDuration()).toBe(200);
  });
});
