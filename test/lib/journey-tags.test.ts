jest.mock('@/lib/db/sessions', () => ({
  getSessionCount: jest.fn(),
}));

jest.mock('@/lib/stats', () => ({
  getStreak: jest.fn(),
  getWeekStats: jest.fn(),
}));

import { getSessionCount } from '@/lib/db/sessions';
import { getStreak, getWeekStats } from '@/lib/stats';
import { getJourneyTags } from '@/lib/journey-tags';
import type { WeekDay } from '@/lib/stats';

const sessionsMock = getSessionCount as jest.MockedFunction<typeof getSessionCount>;
const streakMock = getStreak as jest.MockedFunction<typeof getStreak>;
const weekMock = getWeekStats as jest.MockedFunction<typeof getWeekStats>;

// Empty week — all dates set in the *future* so they never count toward
// the `consistent` achievement's "past days this week" filter. Stage /
// streak tests don't read these fields, so the exact future date is
// irrelevant — just has to be > now.
function emptyWeek(): WeekDay[] {
  return Array.from({ length: 7 }, (_, i) => ({
    date: new Date(Date.now() + (100 + i) * 86400000).toISOString().slice(0, 10),
    dayName: 'X',
    duration: 0,
    isToday: false,
  }));
}

beforeEach(() => {
  sessionsMock.mockReset();
  streakMock.mockReset();
  weekMock.mockReset();
  streakMock.mockReturnValue(0);
  weekMock.mockReturnValue(emptyWeek());
});

describe('stage tag', () => {
  it('omits the stage entirely when sessions === 0', () => {
    sessionsMock.mockReturnValue(0);
    const tags = getJourneyTags();
    expect(tags.find((t) => t.type === 'stage')).toBeUndefined();
  });

  it.each([
    [1, 'beginner'],
    [9, 'beginner'],
    [10, 'building'],
    [49, 'building'],
    [50, 'steady'],
    [99, 'steady'],
    [100, 'devoted'],
    [199, 'devoted'],
    [200, 'still'],
    [500, 'still'],
  ])('with %d sessions → stage = %s', (count, label) => {
    sessionsMock.mockReturnValue(count);
    const tags = getJourneyTags();
    const stage = tags.find((t) => t.type === 'stage');
    expect(stage?.label).toBe(label);
  });
});

describe('streak tag', () => {
  it('appears at 3+ days', () => {
    sessionsMock.mockReturnValue(1);
    streakMock.mockReturnValue(5);
    const tags = getJourneyTags();
    expect(tags.find((t) => t.type === 'streak')?.label).toBe('5-day streak');
  });

  it('is omitted below 3 days', () => {
    sessionsMock.mockReturnValue(1);
    streakMock.mockReturnValue(2);
    const tags = getJourneyTags();
    expect(tags.find((t) => t.type === 'streak')).toBeUndefined();
  });
});

describe('consistent achievement tag', () => {
  // Helper: dates that day.date <= today and day.date > today, so we
  // can drive the daysPassedThisWeek filter. The journey-tags logic
  // compares parsed Date objects, so we use absolute keys.
  const past = (offset: number) =>
    new Date(Date.now() - offset * 86400000).toISOString().slice(0, 10);
  const future = (offset: number) =>
    new Date(Date.now() + offset * 86400000).toISOString().slice(0, 10);

  function week(activePastDays: number): WeekDay[] {
    const days: WeekDay[] = [];
    for (let i = 0; i < activePastDays; i++) {
      days.push({ date: past(activePastDays - i), dayName: 'X', duration: 60, isToday: false });
    }
    // Fill remaining slots with future dates so they fall outside
    // daysPassedThisWeek (the filter only keeps dates ≤ today).
    for (let i = days.length; i < 7; i++) {
      days.push({ date: future(i + 1), dayName: 'X', duration: 0, isToday: false });
    }
    return days;
  }

  it('appears when 3+ past days this week were all active', () => {
    sessionsMock.mockReturnValue(1);
    weekMock.mockReturnValue(week(3));
    const tags = getJourneyTags();
    expect(tags.find((t) => t.id === 'consistent')).toBeDefined();
  });

  it('appears when 5+ past days this week were all active', () => {
    sessionsMock.mockReturnValue(1);
    weekMock.mockReturnValue(week(5));
    const tags = getJourneyTags();
    expect(tags.find((t) => t.id === 'consistent')).toBeDefined();
  });

  it('does NOT appear when fewer than 3 past days are active', () => {
    sessionsMock.mockReturnValue(1);
    weekMock.mockReturnValue(week(1));
    const tags = getJourneyTags();
    expect(tags.find((t) => t.id === 'consistent')).toBeUndefined();
  });
});
